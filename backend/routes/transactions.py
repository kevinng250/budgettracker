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

    profile_id_raw = request.form.get("profile_id")
    if not profile_id_raw:
        return jsonify({"error": "profile_id is required"}), 400
    try:
        profile_id = int(profile_id_raw)
    except ValueError:
        return jsonify({"error": "profile_id must be an integer"}), 400

    try:
        result = process_upload(
            get_db(),
            content,
            filename=file.filename or "",
            raw_bytes=raw,
            profile_id=profile_id,
        )
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
    conditions = ["transactions.parent_id IS NULL"]
    params = []

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    bank = request.args.get("bank")
    account = request.args.get("account")
    tag = request.args.get("tag")
    category = request.args.get("category")
    label_id = request.args.get("label_id")
    profile_id = request.args.get("profile_id")
    search = request.args.get("search")

    if profile_id:
        conditions.append("transactions.profile_id = ?")
        params.append(int(profile_id))
    if date_from:
        conditions.append("transactions.date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("transactions.date <= ?")
        params.append(date_to)
    if bank:
        conditions.append("transactions.bank = ?")
        params.append(bank)
    if account:
        conditions.append("transactions.account = ?")
        params.append(account)
    if tag:
        conditions.append("transactions.tag = ?")
        params.append(tag)
    if category:
        if category == "Uncategorized":
            conditions.append("tags.category IS NULL")
        else:
            conditions.append("tags.category = ?")
            params.append(category)
    if label_id:
        conditions.append("transaction_labels.label_id = ?")
        params.append(int(label_id))
    if search:
        conditions.append("transactions.description LIKE ?")
        params.append(f"%{search}%")

    joins = []
    if category:
        joins.append("LEFT JOIN tags ON transactions.tag = tags.name")
    if label_id:
        joins.append(
            "JOIN transaction_labels ON transaction_labels.transaction_id = transactions.id"
        )
    join = " ".join(joins)
    where = f"WHERE {' AND '.join(conditions)}"

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

    count = db.execute(
        f"SELECT COUNT(*) FROM transactions {join} {where}", params
    ).fetchone()[0]

    rows = db.execute(
        f"SELECT transactions.* FROM transactions {join} {where} "
        f"ORDER BY transactions.{sort_by} {sort_dir}, transactions.id DESC LIMIT ? OFFSET ?",
        params + [per_page, offset],
    ).fetchall()

    transactions = [dict(r) for r in rows]

    # Attach children for split parents
    parent_ids = [t["id"] for t in transactions]
    if parent_ids:
        placeholders = ",".join("?" * len(parent_ids))
        children = db.execute(
            f"SELECT * FROM transactions WHERE parent_id IN ({placeholders}) ORDER BY parent_id, id",
            parent_ids,
        ).fetchall()
        children_by_parent = {}
        for c in children:
            children_by_parent.setdefault(c["parent_id"], []).append(dict(c))
        for t in transactions:
            if t["id"] in children_by_parent:
                t["children"] = children_by_parent[t["id"]]

    # Attach label_ids for each transaction
    if transactions:
        all_ids = [t["id"] for t in transactions]
        for t in transactions:
            for c in t.get("children", []):
                all_ids.append(c["id"])
        placeholders = ",".join("?" * len(all_ids))
        label_rows = db.execute(
            f"SELECT transaction_id, label_id FROM transaction_labels "
            f"WHERE transaction_id IN ({placeholders})",
            all_ids,
        ).fetchall()
        labels_by_txn: dict[int, list[int]] = {}
        for r in label_rows:
            labels_by_txn.setdefault(r["transaction_id"], []).append(r["label_id"])
        for t in transactions:
            t["label_ids"] = labels_by_txn.get(t["id"], [])
            for c in t.get("children", []):
                c["label_ids"] = labels_by_txn.get(c["id"], [])

    return jsonify({
        "transactions": transactions,
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
        # Update all non-split standalone transactions with the same description
        cursor = db.execute(
            "UPDATE transactions SET tag = ? WHERE description = ? "
            "AND parent_id IS NULL "
            "AND id NOT IN (SELECT DISTINCT parent_id FROM transactions WHERE parent_id IS NOT NULL)",
            (tag, row["description"]),
        )
        db.commit()
        return jsonify({"updated": cursor.rowcount})
    else:
        # Update just this one, and report how many others share the same description
        db.execute("UPDATE transactions SET tag = ? WHERE id = ?", (tag, txn_id))
        db.commit()
        others = db.execute(
            "SELECT COUNT(*) FROM transactions WHERE description = ? AND id != ? AND tag != ? "
            "AND parent_id IS NULL "
            "AND id NOT IN (SELECT DISTINCT parent_id FROM transactions WHERE parent_id IS NOT NULL)",
            (row["description"], txn_id, tag),
        ).fetchone()[0]
        return jsonify({**dict(row), "tag": tag, "others_count": others})


@bp.route("/transactions/<int:txn_id>", methods=["DELETE"])
def delete_transaction(txn_id):
    db = get_db()
    # Cascade-delete children if this is a split parent
    db.execute("DELETE FROM transactions WHERE parent_id = ?", (txn_id,))
    db.execute("DELETE FROM transactions WHERE id = ?", (txn_id,))
    db.commit()
    return jsonify({"ok": True})


@bp.route("/transactions/<int:txn_id>/split", methods=["POST"])
def split_transaction(txn_id):
    db = get_db()
    data = request.get_json()
    splits = data.get("splits", [])

    row = db.execute("SELECT * FROM transactions WHERE id = ?", (txn_id,)).fetchone()
    if not row:
        return jsonify({"error": "Transaction not found"}), 404

    if row["parent_id"] is not None:
        return jsonify({"error": "Cannot split a child transaction"}), 400

    has_children = db.execute(
        "SELECT 1 FROM transactions WHERE parent_id = ?", (txn_id,)
    ).fetchone()
    if has_children:
        return jsonify({"error": "Transaction is already split"}), 400

    if len(splits) < 2:
        return jsonify({"error": "At least 2 splits required"}), 400

    # Validate tags exist
    for s in splits:
        if not s.get("tag"):
            return jsonify({"error": "Each split must have a tag"}), 400
        tag_exists = db.execute("SELECT 1 FROM tags WHERE name = ?", (s["tag"],)).fetchone()
        if not tag_exists:
            return jsonify({"error": f"Tag '{s['tag']}' does not exist"}), 400

    # Validate amounts sum to original
    split_total = sum(s["amount"] for s in splits)
    if abs(split_total - row["amount"]) > 0.01:
        return jsonify({
            "error": f"Split amounts ({split_total:.2f}) must equal original ({row['amount']:.2f})"
        }), 400

    children = []
    parent_txn_date = row["transaction_date"] if "transaction_date" in row.keys() else None
    parent_profile_id = row["profile_id"] if "profile_id" in row.keys() else None
    for s in splits:
        cursor = db.execute(
            "INSERT INTO transactions "
            "(date, transaction_date, description, amount, bank, account, tag, parent_id, profile_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                row["date"],
                parent_txn_date,
                row["description"],
                s["amount"],
                row["bank"],
                row["account"],
                s["tag"],
                txn_id,
                parent_profile_id,
            ),
        )
        child = db.execute("SELECT * FROM transactions WHERE id = ?", (cursor.lastrowid,)).fetchone()
        children.append(dict(child))

    db.commit()
    return jsonify({"parent": dict(row), "children": children})


@bp.route("/transactions/<int:txn_id>/merge", methods=["POST"])
def merge_transaction(txn_id):
    db = get_db()

    row = db.execute("SELECT * FROM transactions WHERE id = ?", (txn_id,)).fetchone()
    if not row:
        return jsonify({"error": "Transaction not found"}), 404

    has_children = db.execute(
        "SELECT 1 FROM transactions WHERE parent_id = ?", (txn_id,)
    ).fetchone()
    if not has_children:
        return jsonify({"error": "Transaction is not split"}), 400

    db.execute("DELETE FROM transactions WHERE parent_id = ?", (txn_id,))
    db.commit()

    return jsonify({"transaction": dict(row)})


@bp.route("/transactions/<int:txn_id>/labels", methods=["PUT"])
def replace_transaction_labels(txn_id):
    db = get_db()
    data = request.get_json() or {}
    label_ids = data.get("label_ids", [])
    if not isinstance(label_ids, list):
        return jsonify({"error": "label_ids must be a list"}), 400

    txn = db.execute("SELECT 1 FROM transactions WHERE id = ?", (txn_id,)).fetchone()
    if not txn:
        return jsonify({"error": "Transaction not found"}), 404

    # Validate all label_ids exist
    if label_ids:
        placeholders = ",".join("?" * len(label_ids))
        found = {
            r["id"] for r in db.execute(
                f"SELECT id FROM labels WHERE id IN ({placeholders})", label_ids
            ).fetchall()
        }
        missing = [lid for lid in label_ids if lid not in found]
        if missing:
            return jsonify({"error": f"Unknown label ids: {missing}"}), 400

    db.execute("DELETE FROM transaction_labels WHERE transaction_id = ?", (txn_id,))
    for lid in label_ids:
        db.execute(
            "INSERT OR IGNORE INTO transaction_labels (transaction_id, label_id) VALUES (?, ?)",
            (txn_id, lid),
        )
    db.commit()
    return jsonify({"transaction_id": txn_id, "label_ids": list(label_ids)})


@bp.route("/transactions/labels/bulk-assign", methods=["POST"])
def bulk_assign_label():
    db = get_db()
    data = request.get_json() or {}
    transaction_ids = data.get("transaction_ids", [])
    label_id = data.get("label_id")
    if not isinstance(transaction_ids, list) or not transaction_ids:
        return jsonify({"error": "transaction_ids must be a non-empty list"}), 400
    if label_id is None:
        return jsonify({"error": "label_id is required"}), 400

    label = db.execute("SELECT 1 FROM labels WHERE id = ?", (label_id,)).fetchone()
    if not label:
        return jsonify({"error": "Label not found"}), 404

    inserted = 0
    for tid in transaction_ids:
        cursor = db.execute(
            "INSERT OR IGNORE INTO transaction_labels (transaction_id, label_id) VALUES (?, ?)",
            (tid, label_id),
        )
        inserted += cursor.rowcount
    db.commit()
    return jsonify({"assigned": inserted})


@bp.route("/transactions/labels/bulk-unassign", methods=["POST"])
def bulk_unassign_label():
    db = get_db()
    data = request.get_json() or {}
    transaction_ids = data.get("transaction_ids", [])
    label_id = data.get("label_id")
    if not isinstance(transaction_ids, list) or not transaction_ids:
        return jsonify({"error": "transaction_ids must be a non-empty list"}), 400
    if label_id is None:
        return jsonify({"error": "label_id is required"}), 400

    placeholders = ",".join("?" * len(transaction_ids))
    cursor = db.execute(
        f"DELETE FROM transaction_labels WHERE label_id = ? AND transaction_id IN ({placeholders})",
        [label_id, *transaction_ids],
    )
    db.commit()
    return jsonify({"removed": cursor.rowcount})


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
    profile_id_raw = request.form.get("profile_id")
    if not profile_id_raw:
        return jsonify({"error": "profile_id is required"}), 400
    try:
        profile_id = int(profile_id_raw)
    except ValueError:
        return jsonify({"error": "profile_id must be an integer"}), 400

    try:
        result = process_balance_upload(
            get_db(),
            content,
            filename=file.filename or "",
            raw_bytes=raw,
            profile_id=profile_id,
        )
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
    profile_id = request.args.get("profile_id")
    conditions = ["balance IS NOT NULL"]
    params: list = []
    if bank and account:
        conditions.append("bank = ?")
        conditions.append("account = ?")
        params.extend([bank, account])
    if profile_id:
        conditions.append("profile_id = ?")
        params.append(int(profile_id))
    where = "WHERE " + " AND ".join(conditions)
    rows = db.execute(
        f"SELECT date, balance, bank, account FROM transactions "
        f"{where} ORDER BY date ASC, id ASC",
        params,
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/banks-with-balances", methods=["GET"])
def banks_with_balances():
    db = get_db()
    profile_id = request.args.get("profile_id")
    params: list = []
    extra = ""
    if profile_id:
        extra = " AND profile_id = ?"
        params.append(int(profile_id))
    rows = db.execute(
        f"SELECT DISTINCT bank, account FROM transactions "
        f"WHERE balance IS NOT NULL{extra} ORDER BY bank, account",
        params,
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/upload-log", methods=["GET"])
def upload_log():
    db = get_db()
    profile_id = request.args.get("profile_id")
    if profile_id:
        rows = db.execute(
            "SELECT * FROM upload_log WHERE profile_id = ? ORDER BY uploaded_at DESC",
            (int(profile_id),),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM upload_log ORDER BY uploaded_at DESC"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/upload-log/<int:log_id>", methods=["DELETE"])
def delete_upload_batch(log_id):
    """Delete an upload_log entry, its transactions, and the archived file.

    Precise path: rows stamped with upload_id (post-migration uploads).
    Fallback for legacy rows: bank+account+date BETWEEN date_min AND date_max.
    """
    import os
    db = get_db()
    log = db.execute("SELECT * FROM upload_log WHERE id = ?", (log_id,)).fetchone()
    if not log:
        return jsonify({"error": "Upload log entry not found"}), 404

    cursor = db.execute("DELETE FROM transactions WHERE upload_id = ?", (log_id,))
    deleted = cursor.rowcount

    if deleted == 0:
        cursor = db.execute(
            "DELETE FROM transactions "
            "WHERE bank = ? AND account = ? AND date BETWEEN ? AND ? "
            "AND upload_id IS NULL",
            (log["bank"], log["account"], log["date_min"], log["date_max"]),
        )
        deleted = cursor.rowcount

    # Best-effort archive cleanup; missing/inaccessible files shouldn't fail the call.
    stored_path = log["stored_path"] if "stored_path" in log.keys() else None
    if stored_path:
        try:
            os.remove(stored_path)
        except OSError as e:
            logger.warning(f"Failed to remove archived upload {stored_path}: {e}")

    db.execute("DELETE FROM upload_log WHERE id = ?", (log_id,))
    db.commit()
    return jsonify({"deleted_transactions": deleted})


@bp.route("/banks", methods=["GET"])
def list_banks():
    db = get_db()
    profile_id = request.args.get("profile_id")
    if profile_id:
        rows = db.execute(
            "SELECT DISTINCT bank, account FROM transactions "
            "WHERE profile_id = ? ORDER BY bank, account",
            (int(profile_id),),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT DISTINCT bank, account FROM transactions ORDER BY bank, account"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/account-coverage", methods=["GET"])
def account_coverage():
    """For each (bank, account), report latest/earliest transaction dates and counts.

    Excludes split children so counts reflect the imported source rows.
    """
    db = get_db()
    profile_id = request.args.get("profile_id")
    params: list = []
    extra = ""
    if profile_id:
        extra = " AND profile_id = ?"
        params.append(int(profile_id))
    rows = db.execute(
        f"SELECT bank, account, "
        f"MAX(date) as latest_date, MIN(date) as earliest_date, "
        f"COUNT(*) as count "
        f"FROM transactions WHERE parent_id IS NULL{extra} "
        f"GROUP BY bank, account "
        f"ORDER BY bank, account",
        params,
    ).fetchall()
    return jsonify([dict(r) for r in rows])
