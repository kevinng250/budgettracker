from flask import Blueprint, request, jsonify
from app import get_db

bp = Blueprint("categories", __name__)


@bp.route("/categories", methods=["GET"])
def list_categories():
    db = get_db()
    rows = db.execute(
        "SELECT name, is_default, position FROM categories ORDER BY position, name"
    ).fetchall()
    categories = [dict(r) for r in rows]

    if request.args.get("include_tags"):
        tag_rows = db.execute(
            "SELECT name, is_default, category, is_category FROM tags ORDER BY name"
        ).fetchall()
        by_category = {}
        for t in tag_rows:
            by_category.setdefault(t["category"], []).append(dict(t))
        for c in categories:
            c["tags"] = by_category.get(c["name"], [])

    return jsonify(categories)


@bp.route("/categories", methods=["POST"])
def create_category():
    db = get_db()
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Category name is required"}), 400
    existing = db.execute("SELECT 1 FROM categories WHERE name = ?", (name,)).fetchone()
    if existing:
        return jsonify({"error": f"Category '{name}' already exists"}), 409
    # Avoid colliding with an existing tag name — that would make the synthetic
    # category-tag impossible to create.
    tag_clash = db.execute("SELECT 1 FROM tags WHERE name = ?", (name,)).fetchone()
    if tag_clash:
        return jsonify({
            "error": f"A tag named '{name}' already exists. Pick a different category name."
        }), 409
    next_pos = db.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM categories").fetchone()[0]
    db.execute(
        "INSERT INTO categories (name, is_default, position) VALUES (?, 0, ?)",
        (name, next_pos),
    )
    # Synthetic "category tag" so this category is selectable as a transaction's tag.
    db.execute(
        "INSERT INTO tags (name, is_default, category, is_category) VALUES (?, 1, ?, 1)",
        (name, name),
    )
    db.commit()
    return jsonify({"name": name, "is_default": 0, "position": next_pos}), 201


@bp.route("/categories/<path:name>", methods=["PATCH"])
def rename_category(name):
    db = get_db()
    data = request.get_json() or {}
    new_name = data.get("name", "").strip()
    if not new_name:
        return jsonify({"error": "New name is required"}), 400
    cat = db.execute("SELECT * FROM categories WHERE name = ?", (name,)).fetchone()
    if not cat:
        return jsonify({"error": "Category not found"}), 404
    if new_name != name:
        clash = db.execute("SELECT 1 FROM categories WHERE name = ?", (new_name,)).fetchone()
        if clash:
            return jsonify({"error": f"Category '{new_name}' already exists"}), 409
        # Make sure the new name isn't already taken by a non-category tag.
        tag_clash = db.execute(
            "SELECT 1 FROM tags WHERE name = ? AND is_category = 0", (new_name,)
        ).fetchone()
        if tag_clash:
            return jsonify({
                "error": f"A tag named '{new_name}' already exists."
            }), 409
        # categories.name is PK; tags.category FK has ON UPDATE CASCADE, so the
        # synthetic tag's category column follows. We then rename the synthetic
        # tag itself; transactions.tag FK has ON UPDATE CASCADE so any tagged
        # transactions follow.
        db.execute("UPDATE categories SET name = ? WHERE name = ?", (new_name, name))
        db.execute(
            "UPDATE tags SET name = ? WHERE name = ? AND is_category = 1",
            (new_name, name),
        )
        db.commit()
    return jsonify({"name": new_name, "is_default": cat["is_default"], "position": cat["position"]})


@bp.route("/categories/<path:name>", methods=["DELETE"])
def delete_category(name):
    db = get_db()
    cat = db.execute("SELECT * FROM categories WHERE name = ?", (name,)).fetchone()
    if not cat:
        return jsonify({"error": "Category not found"}), 404
    if cat["is_default"]:
        return jsonify({"error": "Cannot delete default categories"}), 400
    # Drop the synthetic tag too: reassign any transactions using it to 'other'
    # first, then delete it. categories ON DELETE SET NULL clears tags.category
    # for any remaining tags in this category.
    db.execute(
        "UPDATE transactions SET tag = 'other' "
        "WHERE tag IN (SELECT name FROM tags WHERE name = ? AND is_category = 1)",
        (name,),
    )
    db.execute("DELETE FROM tags WHERE name = ? AND is_category = 1", (name,))
    db.execute("DELETE FROM categories WHERE name = ?", (name,))
    db.commit()
    return jsonify({"ok": True})
