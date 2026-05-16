"""Receipt-item CRUD: list, fetch, edit fields, manage per-item tags."""

from flask import Blueprint, jsonify, request

from app import get_db

bp = Blueprint("items", __name__)


def _tags_for_items(db, item_ids: list[int]) -> dict:
    if not item_ids:
        return {}
    placeholders = ",".join("?" * len(item_ids))
    rows = db.execute(
        f"SELECT item_id, tag_name FROM receipt_item_tags WHERE item_id IN ({placeholders})",
        item_ids,
    ).fetchall()
    tags: dict = {}
    for r in rows:
        tags.setdefault(r["item_id"], []).append(r["tag_name"])
    return tags


@bp.route("/items", methods=["GET"])
def list_items():
    db = get_db()
    conditions: list[str] = []
    params: list = []

    search = request.args.get("search")
    if search:
        conditions.append("ri.description LIKE ?")
        params.append(f"%{search}%")

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    if date_from:
        conditions.append("t.date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("t.date <= ?")
        params.append(date_to)

    item_tag = request.args.get("item_tag")
    if item_tag:
        conditions.append(
            "ri.id IN (SELECT item_id FROM receipt_item_tags WHERE tag_name = ?)"
        )
        params.append(item_tag)

    transaction_id = request.args.get("transaction_id")
    if transaction_id:
        conditions.append("ri.transaction_id = ?")
        params.append(int(transaction_id))

    profile_id = request.args.get("profile_id")
    if profile_id:
        conditions.append("t.profile_id = ?")
        params.append(int(profile_id))

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    rows = db.execute(
        f"SELECT ri.*, t.date as transaction_date, t.description as merchant, "
        f"t.receipt_image_path as image_path "
        f"FROM receipt_items ri "
        f"JOIN transactions t ON t.id = ri.transaction_id "
        f"{where} "
        f"ORDER BY t.date DESC, ri.id DESC",
        params,
    ).fetchall()
    items = [dict(r) for r in rows]

    tags_map = _tags_for_items(db, [it["id"] for it in items])
    for it in items:
        it["item_tags"] = tags_map.get(it["id"], [])

    return jsonify(items)


@bp.route("/items/<int:item_id>", methods=["GET"])
def get_item(item_id):
    db = get_db()
    row = db.execute(
        "SELECT ri.*, t.date as transaction_date, t.description as merchant, "
        "t.receipt_image_path as image_path "
        "FROM receipt_items ri "
        "JOIN transactions t ON t.id = ri.transaction_id "
        "WHERE ri.id = ?",
        (item_id,),
    ).fetchone()
    if not row:
        return jsonify({"error": "Item not found"}), 404
    item = dict(row)
    item["item_tags"] = _tags_for_items(db, [item_id]).get(item_id, [])
    return jsonify(item)


@bp.route("/items/<int:item_id>", methods=["PATCH"])
def update_item(item_id):
    db = get_db()
    item = db.execute("SELECT * FROM receipt_items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        return jsonify({"error": "Item not found"}), 404

    data = request.get_json() or {}
    updatable = ["description", "line_total", "quantity", "unit", "unit_price", "notes"]
    fields = []
    values: list = []
    for key in updatable:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])
    if not fields:
        return jsonify({"error": "No updatable fields provided"}), 400
    fields.append("updated_at = datetime('now')")
    values.append(item_id)
    db.execute(
        f"UPDATE receipt_items SET {', '.join(fields)} WHERE id = ?",
        values,
    )
    db.commit()
    return get_item(item_id)


@bp.route("/items/<int:item_id>/tags", methods=["PUT"])
def replace_item_tags(item_id):
    """Replace the full set of tags for one item. Auto-creates missing tags."""
    db = get_db()
    item = db.execute("SELECT 1 FROM receipt_items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        return jsonify({"error": "Item not found"}), 404

    data = request.get_json() or {}
    raw = data.get("item_tags", [])
    if not isinstance(raw, list):
        return jsonify({"error": "item_tags must be a list"}), 400
    cleaned = [t.strip() for t in raw if isinstance(t, str) and t.strip()]

    db.execute("DELETE FROM receipt_item_tags WHERE item_id = ?", (item_id,))
    for t in cleaned:
        db.execute("INSERT OR IGNORE INTO item_tags (name) VALUES (?)", (t,))
        db.execute(
            "INSERT OR IGNORE INTO receipt_item_tags (item_id, tag_name) VALUES (?, ?)",
            (item_id, t),
        )
    db.commit()
    return jsonify({"item_id": item_id, "item_tags": cleaned})


@bp.route("/items/<int:item_id>", methods=["DELETE"])
def delete_item(item_id):
    db = get_db()
    item = db.execute("SELECT 1 FROM receipt_items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        return jsonify({"error": "Item not found"}), 404
    db.execute("DELETE FROM receipt_items WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"ok": True})
