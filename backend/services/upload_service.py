import csv
import io
import logging
import os
import re
from datetime import datetime
from typing import Optional

from config import UPLOAD_ARCHIVE_DIR
from parsers.detector import detect_and_get_parser
from services.tag_inference import infer_tag

logger = logging.getLogger(__name__)


def _sanitize_filename(name: str) -> str:
    """Strip path components and unsafe characters from a filename."""
    # Drop any directory parts that may have come from the client.
    name = os.path.basename(name or "")
    # Replace anything that isn't alnum, dash, dot, underscore.
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name).strip("._-")
    return name or "upload.csv"


def _archive_upload(raw_bytes: bytes, prefix: str, filename: str) -> str:
    """Write raw bytes to UPLOAD_ARCHIVE_DIR with a unique name. Returns the path."""
    os.makedirs(UPLOAD_ARCHIVE_DIR, exist_ok=True)
    safe_name = _sanitize_filename(filename)
    final_name = f"{prefix}_{safe_name}"
    path = os.path.join(UPLOAD_ARCHIVE_DIR, final_name)
    with open(path, "wb") as f:
        f.write(raw_bytes)
    return path


def process_upload(
    db,
    file_content: str,
    filename: str = "",
    raw_bytes: Optional[bytes] = None,
    profile_id: Optional[int] = None,
) -> dict:
    # Handle BOM
    if file_content.startswith("﻿"):
        file_content = file_content[1:]

    reader = csv.DictReader(io.StringIO(file_content))
    logger.info(f"CSV headers detected: {reader.fieldnames}")
    parser = detect_and_get_parser(reader.fieldnames)
    logger.info(f"Matched parser: {parser.__class__.__name__} (bank={parser.bank}, account={parser.account})")
    transactions = parser.parse(reader, filename)
    logger.info(f"Parsed {len(transactions)} transactions from CSV")

    # Most bank CSVs export rows newest-first. Insert in chronological order
    # so row ids increase with time — the "latest balance per account" query
    # breaks same-date ties by MAX(id) and depends on this invariant.
    if len(transactions) > 1 and transactions[0]["date"] > transactions[-1]["date"]:
        transactions.reverse()
        logger.info("Detected newest-first CSV; reversed to chronological order")

    upload_id = None
    stored_path = None
    if transactions:
        dates = [t["date"] for t in transactions]
        date_min = min(dates)
        date_max = max(dates)
        cursor = db.execute(
            "INSERT INTO upload_log "
            "(filename, bank, account, date_min, date_max, inserted, profile_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (filename, parser.bank, parser.account, date_min, date_max, len(transactions), profile_id),
        )
        upload_id = cursor.lastrowid

        # Archive the raw upload alongside the log entry. Filename uses the
        # upload_id as a prefix to guarantee uniqueness even if two CSVs
        # share an original name.
        if raw_bytes is not None:
            try:
                stored_path = _archive_upload(raw_bytes, str(upload_id), filename)
                db.execute(
                    "UPDATE upload_log SET stored_path = ? WHERE id = ?",
                    (stored_path, upload_id),
                )
            except OSError as e:
                logger.warning(f"Failed to archive upload {upload_id}: {e}")

    for txn in transactions:
        txn["tag"] = infer_tag(db, txn["description"])
        txn["upload_id"] = upload_id
        txn["profile_id"] = profile_id
        # Defensive: parsers without transaction_date should still serialize.
        txn.setdefault("transaction_date", None)
        cursor = db.execute(
            "INSERT INTO transactions "
            "(date, transaction_date, description, amount, bank, account, tag, balance, upload_id, profile_id) "
            "VALUES (:date, :transaction_date, :description, :amount, :bank, :account, :tag, :balance, :upload_id, :profile_id)",
            txn,
        )
        txn["id"] = cursor.lastrowid

    db.commit()
    return {
        "inserted": len(transactions),
        "transactions": transactions,
        "upload_id": upload_id,
        "stored_path": stored_path,
    }


def process_balance_upload(
    db,
    file_content: str,
    filename: str = "",
    raw_bytes: Optional[bytes] = None,
    profile_id: Optional[int] = None,
) -> dict:
    if file_content.startswith("﻿"):
        file_content = file_content[1:]

    reader = csv.DictReader(io.StringIO(file_content))
    logger.info(f"[balance] CSV headers detected: {reader.fieldnames}")
    parser = detect_and_get_parser(reader.fieldnames)
    logger.info(f"[balance] Matched parser: {parser.__class__.__name__}")
    transactions = parser.parse(reader, filename)
    logger.info(f"[balance] Parsed {len(transactions)} rows from CSV")

    matched = 0
    unmatched = 0

    profile_clause = " AND profile_id = ?" if profile_id is not None else ""
    for txn in transactions:
        if txn.get("balance") is None:
            continue
        params: list = [
            txn["balance"],
            txn["date"],
            txn["description"],
            txn["amount"],
            txn["bank"],
            txn["account"],
        ]
        if profile_id is not None:
            params.append(profile_id)
        cursor = db.execute(
            "UPDATE transactions SET balance = ? "
            "WHERE date = ? AND description = ? AND amount = ? AND bank = ? "
            f"AND account = ? AND balance IS NULL{profile_clause}",
            params,
        )
        if cursor.rowcount > 0:
            matched += cursor.rowcount
        else:
            unmatched += 1

    db.commit()

    # Archive balance uploads under a timestamped prefix since they don't
    # have an upload_log entry to anchor to.
    stored_path = None
    if raw_bytes is not None:
        try:
            ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
            stored_path = _archive_upload(raw_bytes, f"balances_{ts}", filename)
        except OSError as e:
            logger.warning(f"Failed to archive balance upload: {e}")

    return {"matched": matched, "unmatched": unmatched, "stored_path": stored_path}
