"""CRUD for receipt-item tags. Separate namespace from transaction `tags`."""

from flask import Blueprint, jsonify, request

from app import get_db

bp = Blueprint("item_tags", __name__)


@bp.route("/item-tags", methods=["GET"])
def list_item_tags():
    db = get_db()
    rows = db.execute(
        "SELECT t.name, t.is_default, t.created_at, "
        "COALESCE(stats.usage, 0) as usage_count, "
        # Most-recently-used unit across receipt_items carrying this tag.
        # Helps the UI default the unit field consistently per product.
        "("
        "  SELECT ri.unit FROM receipt_items ri "
        "  JOIN receipt_item_tags rit ON rit.item_id = ri.id "
        "  WHERE rit.tag_name = t.name "
        "    AND ri.unit IS NOT NULL AND ri.unit != '' "
        "  ORDER BY ri.id DESC LIMIT 1"
        ") as last_unit "
        "FROM item_tags t "
        "LEFT JOIN ("
        "  SELECT tag_name, COUNT(*) as usage FROM receipt_item_tags GROUP BY tag_name"
        ") stats ON stats.tag_name = t.name "
        "ORDER BY t.name"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/item-tags", methods=["POST"])
def create_item_tag():
    db = get_db()
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Tag name is required"}), 400
    existing = db.execute("SELECT 1 FROM item_tags WHERE name = ?", (name,)).fetchone()
    if existing:
        return jsonify({"error": f"Item tag '{name}' already exists"}), 409
    db.execute("INSERT INTO item_tags (name) VALUES (?)", (name,))
    db.commit()
    return jsonify({"name": name, "is_default": 0, "usage_count": 0}), 201


@bp.route("/item-tags/<path:name>", methods=["PATCH"])
def rename_item_tag(name):
    db = get_db()
    data = request.get_json() or {}
    new_name = (data.get("name") or "").strip()
    if not new_name:
        return jsonify({"error": "New name is required"}), 400
    tag = db.execute("SELECT * FROM item_tags WHERE name = ?", (name,)).fetchone()
    if not tag:
        return jsonify({"error": "Item tag not found"}), 404
    if new_name != name:
        clash = db.execute(
            "SELECT 1 FROM item_tags WHERE name = ?", (new_name,)
        ).fetchone()
        if clash:
            return jsonify({"error": f"Item tag '{new_name}' already exists"}), 409
        # receipt_item_tags.tag_name FK has ON UPDATE CASCADE.
        db.execute("UPDATE item_tags SET name = ? WHERE name = ?", (new_name, name))
        db.commit()
    return jsonify({"name": new_name, "is_default": tag["is_default"]})


@bp.route("/item-tags/<path:name>", methods=["DELETE"])
def delete_item_tag(name):
    db = get_db()
    tag = db.execute("SELECT * FROM item_tags WHERE name = ?", (name,)).fetchone()
    if not tag:
        return jsonify({"error": "Item tag not found"}), 404
    # receipt_item_tags FK has ON DELETE CASCADE.
    db.execute("DELETE FROM item_tags WHERE name = ?", (name,))
    db.commit()
    return jsonify({"ok": True})
