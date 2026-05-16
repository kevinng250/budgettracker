"""Receipt-photo upload + extraction endpoints.

Uses Claude vision to parse a receipt image into structured line items,
then lets the frontend either link the items as splits against an existing
transaction or create a new parent transaction for them.
"""

import json
import logging
import os
import re
import traceback
from datetime import datetime, timedelta
from typing import Optional

from flask import Blueprint, jsonify, request

from app import get_db
from config import UPLOAD_ARCHIVE_DIR
from services.receipt_parser import parse_receipt

logger = logging.getLogger(__name__)

bp = Blueprint("receipts", __name__)

RECEIPTS_SUBDIR = "receipts"
DATE_SANITY_DAYS = 90
SUM_TOLERANCE = 0.02
SPLIT_TOLERANCE = 0.01


def _sanitize_filename(name: str) -> str:
    name = os.path.basename(name or "")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name).strip("._-")
    return name or "receipt.jpg"


def _archive_receipt(raw_bytes: bytes, filename: str) -> str:
    """Save the raw image under UPLOAD_ARCHIVE_DIR/receipts/<timestamp>_<filename>."""
    target_dir = os.path.join(UPLOAD_ARCHIVE_DIR, RECEIPTS_SUBDIR)
    os.makedirs(target_dir, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    safe_name = _sanitize_filename(filename)
    path = os.path.join(target_dir, f"{ts}_{safe_name}")
    with open(path, "wb") as f:
        f.write(raw_bytes)
    return path


def _inject_implicit_lines(extracted: dict) -> None:
    """Append synthetic line items so line_items always sum to `total`.

    Children of a split parent must sum to the parent's amount, so any gap
    between extracted line items and the receipt total has to be promoted to
    explicit lines:
      - If the receipt has a separate `tax` field, append a Tax line.
      - Any remaining gap (Claude misread or skipped items) becomes a single
        "Unaccounted" line the user can rename / redistribute on review.
    """
    items = extracted.get("line_items") or []
    total = extracted.get("total")
    if total is None:
        return

    items_sum = round(sum((it.get("line_total") or 0) for it in items), 2)
    gap = round(total - items_sum, 2)
    if abs(gap) < SUM_TOLERANCE:
        return

    tax = extracted.get("tax")
    if tax is not None and tax > 0:
        items.append({
            "description": "Tax",
            "line_total": tax,
            "is_discount": False,
            "suggested_tag": "other",
        })
        items_sum = round(items_sum + tax, 2)
        gap = round(total - items_sum, 2)

    if abs(gap) >= SUM_TOLERANCE:
        items.append({
            "description": "Unaccounted",
            "line_total": gap,
            "is_discount": False,
            "suggested_tag": "other",
        })

    extracted["line_items"] = items


def _check_sums(extracted: dict) -> list[str]:
    warnings: list[str] = []
    items = extracted.get("line_items") or []
    item_sum = round(sum((it.get("line_total") or 0) for it in items), 2)
    subtotal = extracted.get("subtotal")
    tax = extracted.get("tax")
    total = extracted.get("total")

    if subtotal is not None and abs(item_sum - subtotal) > SUM_TOLERANCE:
        warnings.append(
            f"Line items sum to {item_sum:.2f} but subtotal reads {subtotal:.2f}."
        )
    if subtotal is not None and tax is not None and total is not None:
        if abs(subtotal + tax - total) > SUM_TOLERANCE:
            warnings.append(
                f"Subtotal {subtotal:.2f} + tax {tax:.2f} != total {total:.2f}."
            )
    if total is not None and abs(item_sum - total) > SUM_TOLERANCE and not subtotal:
        warnings.append(
            f"Line items sum to {item_sum:.2f} but receipt total is {total:.2f}."
        )

    date_str = extracted.get("purchase_date")
    if date_str:
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d").date()
            today = datetime.utcnow().date()
            if abs((today - d).days) > DATE_SANITY_DAYS:
                warnings.append(
                    f"Purchase date {date_str} is more than {DATE_SANITY_DAYS} days from today."
                )
        except ValueError:
            warnings.append(f"Could not parse purchase date '{date_str}'.")
    return warnings


def _find_match(db, extracted: dict) -> Optional[dict]:
    total = extracted.get("total")
    date_str = extracted.get("purchase_date")
    if total is None or not date_str:
        return None
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None

    date_lo = (d - timedelta(days=2)).isoformat()
    date_hi = (d + timedelta(days=2)).isoformat()
    rows = db.execute(
        "SELECT id, date, description, amount, bank, account FROM transactions "
        "WHERE parent_id IS NULL "
        "AND id NOT IN (SELECT DISTINCT parent_id FROM transactions WHERE parent_id IS NOT NULL) "
        "AND ABS(amount - ?) < 0.05 "
        "AND date BETWEEN ? AND ? "
        "ORDER BY ABS(amount - ?), date",
        (total, date_lo, date_hi, total),
    ).fetchall()
    candidates = [dict(r) for r in rows[:5]]
    if not candidates:
        return None
    return {
        "candidates": candidates,
        "confidence": "high" if len(candidates) == 1 else "low",
    }


@bp.route("/receipts/upload", methods=["POST"])
def upload_receipt():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    raw = file.read()
    if not raw:
        return jsonify({"error": "Empty file"}), 400

    mime = file.content_type or "image/jpeg"
    if not mime.startswith("image/"):
        return jsonify({"error": f"Unsupported content type: {mime}"}), 400

    profile_id_raw = request.form.get("profile_id")
    if not profile_id_raw:
        return jsonify({"error": "profile_id is required"}), 400
    try:
        profile_id = int(profile_id_raw)
    except ValueError:
        return jsonify({"error": "profile_id must be an integer"}), 400

    try:
        stored_path = _archive_receipt(raw, file.filename or "receipt.jpg")
    except OSError as e:
        logger.warning(f"Failed to archive receipt: {e}")
        stored_path = None

    db = get_db()
    known_tags = [
        r["name"]
        for r in db.execute(
            "SELECT name FROM tags WHERE is_category = 0 ORDER BY name"
        ).fetchall()
    ]

    try:
        extracted = parse_receipt(raw, mime_type=mime, known_tags=known_tags)
    except RuntimeError as e:
        logger.error(f"Receipt parsing failed: {e}")
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        logger.error(f"Receipt parsing crashed: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": "Receipt parsing failed"}), 500

    # If the model returned tax/tip as a separate field and the line items only
    # sum to subtotal, append a synthetic line so the items sum to total. The
    # user can tag it (or delete it) on the review screen.
    _inject_implicit_lines(extracted)

    warnings = _check_sums(extracted)

    # Queue for review (no inline review screen anymore — capture and review
    # are intentionally separate steps so phone uploads can be reviewed on
    # the laptop later).
    cursor = db.execute(
        "INSERT INTO pending_receipts "
        "(image_path, extracted_json, warnings_json, merchant, purchase_date, total, profile_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            stored_path,
            json.dumps(extracted),
            json.dumps(warnings),
            extracted.get("merchant"),
            extracted.get("purchase_date"),
            extracted.get("total"),
            profile_id,
        ),
    )
    db.commit()

    return jsonify({
        "pending_id": cursor.lastrowid,
        "queued": True,
        "stored_path": stored_path,
        "warnings_count": len(warnings),
    })


@bp.route("/receipts/save", methods=["POST"])
def save_receipt():
    data = request.get_json() or {}
    extracted = data.get("extracted") or {}
    target = data.get("target") or {}
    stored_path = data.get("stored_path")
    pending_id = data.get("pending_id")
    body_profile_id = data.get("profile_id")

    line_items = extracted.get("line_items") or []
    if not line_items:
        return jsonify({"error": "No line items to save"}), 400
    if len(line_items) < 1:
        return jsonify({"error": "Need at least one line item"}), 400

    total = extracted.get("total")
    if total is None:
        return jsonify({"error": "Receipt total is required"}), 400

    items_sum = round(sum((it.get("line_total") or 0) for it in line_items), 2)
    if abs(items_sum - total) > SPLIT_TOLERANCE:
        return jsonify({
            "error": (
                f"Line items ({items_sum:.2f}) must equal receipt total "
                f"({total:.2f}) within {SPLIT_TOLERANCE:.2f} to save."
            )
        }), 400

    db = get_db()

    # Validate every suggested tag exists.
    for it in line_items:
        tag = (it.get("tag") or it.get("suggested_tag") or "other").strip().lower()
        if not db.execute("SELECT 1 FROM tags WHERE name = ?", (tag,)).fetchone():
            return jsonify({"error": f"Tag '{tag}' does not exist"}), 400
        it["_resolved_tag"] = tag

    kind = target.get("kind")
    parent_id: Optional[int] = None

    # Resolve effective profile_id. Pending receipt's profile_id wins; otherwise
    # the request body must supply it (for `create` without a pending_id).
    pending_profile_id: Optional[int] = None
    if pending_id is not None:
        p = db.execute(
            "SELECT profile_id FROM pending_receipts WHERE id = ?", (pending_id,)
        ).fetchone()
        if p:
            pending_profile_id = p["profile_id"]

    if kind == "link":
        parent_id = target.get("transaction_id")
        if not parent_id:
            return jsonify({"error": "transaction_id is required when kind='link'"}), 400
        parent = db.execute(
            "SELECT * FROM transactions WHERE id = ?", (parent_id,)
        ).fetchone()
        if not parent:
            return jsonify({"error": "Target transaction not found"}), 404
        if parent["parent_id"] is not None:
            return jsonify({"error": "Cannot attach a receipt to a split child"}), 400
        has_children = db.execute(
            "SELECT 1 FROM transactions WHERE parent_id = ?", (parent_id,)
        ).fetchone()
        if has_children:
            return jsonify({"error": "Target transaction is already split"}), 400
        if abs(parent["amount"] - total) > 0.05:
            return jsonify({
                "error": (
                    f"Receipt total {total:.2f} does not match target transaction "
                    f"amount {parent['amount']:.2f}."
                )
            }), 400
        parent_date = parent["date"]
        parent_bank = parent["bank"]
        parent_account = parent["account"]
        # Inherit the parent's transaction_date if present.
        parent_txn_date = (
            parent["transaction_date"] if "transaction_date" in parent.keys() else None
        )
        parent_profile_id = parent["profile_id"] if "profile_id" in parent.keys() else None

    elif kind == "create":
        # Pending row's profile wins; otherwise require it from the body.
        if pending_profile_id is not None:
            parent_profile_id = pending_profile_id
        elif body_profile_id is not None:
            try:
                parent_profile_id = int(body_profile_id)
            except (TypeError, ValueError):
                return jsonify({"error": "profile_id must be an integer"}), 400
        else:
            return jsonify({"error": "profile_id is required when creating a new transaction"}), 400

        merchant = (extracted.get("merchant") or "Receipt").strip() or "Receipt"
        date_str = extracted.get("purchase_date") or datetime.utcnow().date().isoformat()
        parent_txn_date = date_str
        cursor = db.execute(
            "INSERT INTO transactions "
            "(date, transaction_date, description, amount, bank, account, tag, receipt_image_path, profile_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (date_str, parent_txn_date, merchant, total, "Receipt", merchant, "other", stored_path, parent_profile_id),
        )
        parent_id = cursor.lastrowid
        parent_date = date_str
        parent_bank = "Receipt"
        parent_account = merchant
    else:
        return jsonify({"error": "target.kind must be 'link' or 'create'"}), 400

    # Stamp the image path on the parent (link mode too) so the receipt image is
    # discoverable from any related row.
    if stored_path and kind == "link":
        db.execute(
            "UPDATE transactions SET receipt_image_path = ? WHERE id = ?",
            (stored_path, parent_id),
        )

    children = []
    items = []
    for it in line_items:
        desc = (it.get("description") or "").strip() or "Item"
        amount = float(it.get("line_total") or 0)
        cursor = db.execute(
            "INSERT INTO transactions "
            "(date, transaction_date, description, amount, bank, account, tag, parent_id, profile_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                parent_date,
                parent_txn_date,
                desc,
                amount,
                parent_bank,
                parent_account,
                it["_resolved_tag"],
                parent_id,
                parent_profile_id,
            ),
        )
        children.append({
            "id": cursor.lastrowid,
            "description": desc,
            "amount": amount,
            "tag": it["_resolved_tag"],
        })

        # Optional per-item enrichment fields (manually entered or AI-suggested).
        quantity = it.get("quantity")
        unit = (it.get("unit") or "").strip() or None
        unit_price = it.get("unit_price")
        notes = (it.get("notes") or "").strip() or None
        item_cursor = db.execute(
            "INSERT INTO receipt_items "
            "(transaction_id, description, line_total, quantity, unit, unit_price, notes) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (parent_id, desc, amount, quantity, unit, unit_price, notes),
        )
        item_id = item_cursor.lastrowid

        # Item-level tags (separate from transaction tags). Auto-create any
        # tag the user is using for the first time.
        raw_tags = it.get("item_tags") or []
        item_tag_names: list[str] = []
        for raw in raw_tags:
            if not isinstance(raw, str):
                continue
            t = raw.strip()
            if not t:
                continue
            db.execute(
                "INSERT OR IGNORE INTO item_tags (name) VALUES (?)", (t,)
            )
            db.execute(
                "INSERT OR IGNORE INTO receipt_item_tags (item_id, tag_name) VALUES (?, ?)",
                (item_id, t),
            )
            item_tag_names.append(t)

        items.append({
            "id": item_id,
            "description": desc,
            "line_total": amount,
            "quantity": quantity,
            "unit": unit,
            "unit_price": unit_price,
            "notes": notes,
            "item_tags": item_tag_names,
        })

    # If this save consumed a pending capture, remove it from the queue.
    if pending_id is not None:
        db.execute("DELETE FROM pending_receipts WHERE id = ?", (pending_id,))

    db.commit()
    return jsonify({
        "parent_id": parent_id,
        "children": children,
        "items": items,
        "linked": kind == "link",
    })


# -- Pending receipts queue ------------------------------------------------


@bp.route("/pending-receipts", methods=["GET"])
def list_pending_receipts():
    db = get_db()
    profile_id = request.args.get("profile_id")
    if profile_id:
        rows = db.execute(
            "SELECT id, image_path, merchant, purchase_date, total, "
            "warnings_json, created_at "
            "FROM pending_receipts WHERE profile_id = ? "
            "ORDER BY created_at DESC, id DESC",
            (int(profile_id),),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT id, image_path, merchant, purchase_date, total, "
            "warnings_json, created_at "
            "FROM pending_receipts ORDER BY created_at DESC, id DESC"
        ).fetchall()
    result = []
    for r in rows:
        warnings_count = 0
        if r["warnings_json"]:
            try:
                warnings_count = len(json.loads(r["warnings_json"]))
            except Exception:
                pass
        result.append({
            "id": r["id"],
            "image_path": r["image_path"],
            "merchant": r["merchant"],
            "purchase_date": r["purchase_date"],
            "total": r["total"],
            "warnings_count": warnings_count,
            "created_at": r["created_at"],
        })
    return jsonify(result)


@bp.route("/pending-receipts/<int:pending_id>", methods=["GET"])
def get_pending_receipt(pending_id):
    db = get_db()
    row = db.execute(
        "SELECT * FROM pending_receipts WHERE id = ?", (pending_id,)
    ).fetchone()
    if not row:
        return jsonify({"error": "Pending receipt not found"}), 404
    try:
        extracted = json.loads(row["extracted_json"])
    except Exception:
        return jsonify({"error": "Stored extraction is corrupt"}), 500
    try:
        warnings = json.loads(row["warnings_json"]) if row["warnings_json"] else []
    except Exception:
        warnings = []

    # Recompute match suggestion at read time so transactions imported AFTER
    # the upload still get considered.
    match = _find_match(db, extracted)
    return jsonify({
        "id": row["id"],
        "extracted": extracted,
        "warnings": warnings,
        "stored_path": row["image_path"],
        "match_suggestion": match,
        "created_at": row["created_at"],
    })


@bp.route("/pending-receipts/<int:pending_id>", methods=["DELETE"])
def delete_pending_receipt(pending_id):
    db = get_db()
    row = db.execute(
        "SELECT 1 FROM pending_receipts WHERE id = ?", (pending_id,)
    ).fetchone()
    if not row:
        return jsonify({"error": "Pending receipt not found"}), 404
    db.execute("DELETE FROM pending_receipts WHERE id = ?", (pending_id,))
    db.commit()
    # Image archive is intentionally preserved (audit / re-parse).
    return jsonify({"ok": True})
