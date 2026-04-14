import logging
import traceback

from flask import Blueprint, request, jsonify
from app import get_db
from services.upload_service import process_upload, process_balance_upload

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

bp = Blueprint("transactions", __name__)


@bp.route("/upload", methods=["POST"])
def upload():
    logger.info("=== Upload request received ===")
    logger.info(f"Files in request: {list(request.files.keys())}")
    logger.info(f"Form data: {list(request.form.keys())}")

    if "file" not in request.files:
        logger.error("No 'file' key in request.files")
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    logger.info(f"File: name={file.filename}, content_type={file.content_type}")

    raw = file.read()
    logger.info(f"Raw file size: {len(raw)} bytes")
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            content = raw.decode(encoding)
            logger.info(f"Decoded with {encoding}")
            break
        except UnicodeDecodeError:
            continue
    else:
        return jsonify({"error": "Could not decode file"}), 400

    if not content.strip():
        logger.error("File is empty after decoding")
        return jsonify({"error": "Empty file"}), 400

    logger.info(f"First 200 chars: {content[:200]!r}")

    try:
        result = process_upload(get_db(), content, filename=file.filename or "")
        logger.info(f"Upload result: inserted={result['inserted']}")
        return jsonify(result)
    except ValueError as e:
        logger.error(f"ValueError during upload: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Unexpected error during upload: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@bp.route("/transactions", methods=["GET"])
def list_transactions():
    db = get_db()
    conditions = []
    params = []

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    bank = request.args.get("bank")
    account = request.args.get("account")
    tag = request.args.get("tag")
    search = request.args.get("search")

    if date_from:
        conditions.append("date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("date <= ?")
        params.append(date_to)
    if bank:
        conditions.append("bank = ?")
        params.append(bank)
    if account:
        conditions.append("account = ?")
        params.append(account)
    if tag:
        conditions.append("tag = ?")
        params.append(tag)
    if search:
        conditions.append("description LIKE ?")
        params.append(f"%{search}%")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sort_by = request.args.get("sort_by", "date")
    sort_dir = request.args.get("sort_dir", "desc")
    allowed_sorts = {"date", "description", "amount", "bank", "account", "tag"}
    if sort_by not in allowed_sorts:
        sort_by = "date"
    if sort_dir not in ("asc", "desc"):
        sort_dir = "desc"

    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, max(1, int(request.args.get("per_page", 50))))
    offset = (page - 1) * per_page

    count = db.execute(f"SELECT COUNT(*) FROM transactions {where}", params).fetchone()[0]

    rows = db.execute(
        f"SELECT * FROM transactions {where} ORDER BY {sort_by} {sort_dir}, id DESC LIMIT ? OFFSET ?",
        params + [per_page, offset],
    ).fetchall()

    return jsonify({
        "transactions": [dict(r) for r in rows],
        "total": count,
        "page": page,
        "per_page": per_page,
    })


@bp.route("/transactions/<int:txn_id>", methods=["PATCH"])
def update_transaction(txn_id):
    db = get_db()
    data = request.get_json()
    tag = data.get("tag")
    bulk = data.get("bulk", False)
    if not tag:
        return jsonify({"error": "Tag is required"}), 400

    tag_exists = db.execute("SELECT 1 FROM tags WHERE name = ?", (tag,)).fetchone()
    if not tag_exists:
        return jsonify({"error": f"Tag '{tag}' does not exist"}), 400

    row = db.execute("SELECT * FROM transactions WHERE id = ?", (txn_id,)).fetchone()
    if not row:
        return jsonify({"error": "Transaction not found"}), 404

    if bulk:
        # Update all transactions with the same description
        cursor = db.execute(
            "UPDATE transactions SET tag = ? WHERE description = ?",
            (tag, row["description"]),
        )
        db.commit()
        return jsonify({"updated": cursor.rowcount})
    else:
        # Update just this one, and report how many others share the same description
        db.execute("UPDATE transactions SET tag = ? WHERE id = ?", (tag, txn_id))
        db.commit()
        others = db.execute(
            "SELECT COUNT(*) FROM transactions WHERE description = ? AND id != ? AND tag != ?",
            (row["description"], txn_id, tag),
        ).fetchone()[0]
        return jsonify({**dict(row), "tag": tag, "others_count": others})


@bp.route("/transactions/<int:txn_id>", methods=["DELETE"])
def delete_transaction(txn_id):
    db = get_db()
    db.execute("DELETE FROM transactions WHERE id = ?", (txn_id,))
    db.commit()
    return jsonify({"ok": True})


@bp.route("/upload-balances", methods=["POST"])
def upload_balances():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    raw = file.read()
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            content = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        return jsonify({"error": "Could not decode file"}), 400
    if not content.strip():
        return jsonify({"error": "Empty file"}), 400
    try:
        result = process_balance_upload(get_db(), content, filename=file.filename or "")
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Balance upload error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@bp.route("/balance-history", methods=["GET"])
def balance_history():
    db = get_db()
    bank = request.args.get("bank")
    account = request.args.get("account")
    if bank and account:
        rows = db.execute(
            "SELECT date, balance, bank, account FROM transactions "
            "WHERE bank = ? AND account = ? AND balance IS NOT NULL "
            "ORDER BY date ASC, id ASC",
            (bank, account),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT date, balance, bank, account FROM transactions "
            "WHERE balance IS NOT NULL "
            "ORDER BY date ASC, id ASC",
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/banks-with-balances", methods=["GET"])
def banks_with_balances():
    db = get_db()
    rows = db.execute(
        "SELECT DISTINCT bank, account FROM transactions "
        "WHERE balance IS NOT NULL ORDER BY bank, account"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/upload-log", methods=["GET"])
def upload_log():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM upload_log ORDER BY uploaded_at DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/banks", methods=["GET"])
def list_banks():
    db = get_db()
    rows = db.execute(
        "SELECT DISTINCT bank, account FROM transactions ORDER BY bank, account"
    ).fetchall()
    return jsonify([dict(r) for r in rows])
