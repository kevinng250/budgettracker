from flask import Blueprint, request, jsonify
from app import get_db

bp = Blueprint("tags", __name__)


@bp.route("/tags", methods=["GET"])
def list_tags():
    db = get_db()
    rows = db.execute(
        "SELECT name, is_default, category, is_category FROM tags ORDER BY name"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/tags", methods=["POST"])
def create_tag():
    db = get_db()
    data = request.get_json() or {}
    name = data.get("name", "").strip().lower()
    if not name:
        return jsonify({"error": "Tag name is required"}), 400
    existing = db.execute("SELECT 1 FROM tags WHERE name = ?", (name,)).fetchone()
    if existing:
        return jsonify({"error": f"Tag '{name}' already exists"}), 409
    # Don't let a user-created tag collide with a category name.
    cat_clash = db.execute("SELECT 1 FROM categories WHERE name = ?", (name,)).fetchone()
    if cat_clash:
        return jsonify({
            "error": f"'{name}' is already a category. Pick the category in the dropdown instead."
        }), 409
    category = data.get("category")
    if category is not None:
        cat_exists = db.execute("SELECT 1 FROM categories WHERE name = ?", (category,)).fetchone()
        if not cat_exists:
            return jsonify({"error": f"Category '{category}' does not exist"}), 400
    db.execute(
        "INSERT INTO tags (name, is_default, category, is_category) VALUES (?, 0, ?, 0)",
        (name, category),
    )
    db.commit()
    return jsonify({"name": name, "is_default": 0, "category": category, "is_category": 0}), 201


@bp.route("/tags/<path:name>", methods=["PATCH"])
def update_tag(name):
    db = get_db()
    data = request.get_json() or {}
    tag = db.execute("SELECT * FROM tags WHERE name = ?", (name,)).fetchone()
    if not tag:
        return jsonify({"error": "Tag not found"}), 404
    if tag["is_category"]:
        return jsonify({
            "error": "Category tags are managed automatically. Edit the category instead."
        }), 400

    final_name = name
    if "name" in data:
        new_name = (data.get("name") or "").strip().lower()
        if not new_name:
            return jsonify({"error": "New name is required"}), 400
        if new_name != name:
            clash = db.execute("SELECT 1 FROM tags WHERE name = ?", (new_name,)).fetchone()
            if clash:
                return jsonify({"error": f"Tag '{new_name}' already exists"}), 409
            cat_clash = db.execute(
                "SELECT 1 FROM categories WHERE name = ?", (new_name,)
            ).fetchone()
            if cat_clash:
                return jsonify({
                    "error": f"'{new_name}' is already a category."
                }), 409
            # transactions.tag FK has ON UPDATE CASCADE
            db.execute("UPDATE tags SET name = ? WHERE name = ?", (new_name, name))
            final_name = new_name

    if "category" in data:
        category = data.get("category")
        if category is not None:
            category = category.strip() if isinstance(category, str) else category
            if category == "":
                category = None
        if category is not None:
            cat_exists = db.execute("SELECT 1 FROM categories WHERE name = ?", (category,)).fetchone()
            if not cat_exists:
                return jsonify({"error": f"Category '{category}' does not exist"}), 400
        db.execute("UPDATE tags SET category = ? WHERE name = ?", (category, final_name))

    db.commit()
    row = db.execute(
        "SELECT name, is_default, category, is_category FROM tags WHERE name = ?",
        (final_name,),
    ).fetchone()
    return jsonify(dict(row))


@bp.route("/tags/<path:name>", methods=["DELETE"])
def delete_tag(name):
    db = get_db()
    tag = db.execute("SELECT * FROM tags WHERE name = ?", (name,)).fetchone()
    if not tag:
        return jsonify({"error": "Tag not found"}), 404
    if tag["is_category"]:
        return jsonify({
            "error": "Category tags are managed automatically. Delete the category instead."
        }), 400
    if tag["is_default"]:
        return jsonify({"error": "Cannot delete default tags"}), 400
    db.execute("UPDATE transactions SET tag = 'other' WHERE tag = ?", (name,))
    db.execute("DELETE FROM tags WHERE name = ?", (name,))
    db.commit()
    return jsonify({"ok": True})
