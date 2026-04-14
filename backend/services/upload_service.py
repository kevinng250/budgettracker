import csv
import io
import logging

from parsers.detector import detect_and_get_parser
from services.tag_inference import infer_tag

logger = logging.getLogger(__name__)


def process_upload(db, file_content: str, filename: str = "") -> dict:
    # Handle BOM
    if file_content.startswith("\ufeff"):
        file_content = file_content[1:]

    reader = csv.DictReader(io.StringIO(file_content))
    logger.info(f"CSV headers detected: {reader.fieldnames}")
    parser = detect_and_get_parser(reader.fieldnames)
    logger.info(f"Matched parser: {parser.__class__.__name__} (bank={parser.bank}, account={parser.account})")
    transactions = parser.parse(reader, filename)
    logger.info(f"Parsed {len(transactions)} transactions from CSV")

    for txn in transactions:
        txn["tag"] = infer_tag(db, txn["description"])
        cursor = db.execute(
            "INSERT INTO transactions (date, description, amount, bank, account, tag, balance) "
            "VALUES (:date, :description, :amount, :bank, :account, :tag, :balance)",
            txn,
        )
        txn["id"] = cursor.lastrowid

    # Log the upload with date range
    if transactions:
        dates = [t["date"] for t in transactions]
        date_min = min(dates)
        date_max = max(dates)
        db.execute(
            "INSERT INTO upload_log (filename, bank, account, date_min, date_max, inserted) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (filename, parser.bank, parser.account, date_min, date_max, len(transactions)),
        )

    db.commit()
    return {"inserted": len(transactions), "transactions": transactions}


def process_balance_upload(db, file_content: str, filename: str = "") -> dict:
    if file_content.startswith("\ufeff"):
        file_content = file_content[1:]

    reader = csv.DictReader(io.StringIO(file_content))
    logger.info(f"[balance] CSV headers detected: {reader.fieldnames}")
    parser = detect_and_get_parser(reader.fieldnames)
    logger.info(f"[balance] Matched parser: {parser.__class__.__name__}")
    transactions = parser.parse(reader, filename)
    logger.info(f"[balance] Parsed {len(transactions)} rows from CSV")

    matched = 0
    unmatched = 0

    for txn in transactions:
        if txn.get("balance") is None:
            continue
        cursor = db.execute(
            "UPDATE transactions SET balance = ? "
            "WHERE date = ? AND description = ? AND amount = ? AND bank = ? AND account = ? AND balance IS NULL",
            (txn["balance"], txn["date"], txn["description"], txn["amount"], txn["bank"], txn["account"]),
        )
        if cursor.rowcount > 0:
            matched += cursor.rowcount
        else:
            unmatched += 1

    db.commit()
    return {"matched": matched, "unmatched": unmatched}
