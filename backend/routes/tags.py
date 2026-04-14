from flask import Blueprint, request, jsonify
from app import get_db

bp = Blueprint("tags", __name__)


@bp.route("/tags", methods=["GET"])
def list_tags():
    db = get_db()
    rows = db.execute("SELECT * FROM tags ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/tags", methods=["POST"])
def create_tag():
    db = get_db()
    data = request.get_json()
    name = data.get("name", "").strip().lower()
    if not name:
        return jsonify({"error": "Tag name is required"}), 400
    existing = db.execute("SELECT 1 FROM tags WHERE name = ?", (name,)).fetchone()
    if existing:
        return jsonify({"error": f"Tag '{name}' already exists"}), 409
    db.execute("INSERT INTO tags (name, is_default) VALUES (?, 0)", (name,))
    db.commit()
    return jsonify({"name": name, "is_default": 0}), 201


@bp.route("/tags/<name>", methods=["PATCH"])
def rename_tag(name):
    db = get_db()
    data = request.get_json()
    new_name = data.get("name", "").strip().lower()
    if not new_name:
        return jsonify({"error": "New name is required"}), 400
    tag = db.execute("SELECT * FROM tags WHERE name = ?", (name,)).fetchone()
    if not tag:
        return jsonify({"error": "Tag not found"}), 404
    # Update transactions first, then rename tag
    db.execute("UPDATE transactions SET tag = ? WHERE tag = ?", (new_name, name))
    db.execute("DELETE FROM tags WHERE name = ?", (name,))
    db.execute(
        "INSERT INTO tags (name, is_default) VALUES (?, ?)",
        (new_name, tag["is_default"]),
    )
    db.commit()
    return jsonify({"name": new_name, "is_default": tag["is_default"]})


@bp.route("/tags/<name>", methods=["DELETE"])
def delete_tag(name):
    db = get_db()
    tag = db.execute("SELECT * FROM tags WHERE name = ?", (name,)).fetchone()
    if not tag:
        return jsonify({"error": "Tag not found"}), 404
    if tag["is_default"]:
        return jsonify({"error": "Cannot delete default tags"}), 400
    db.execute("UPDATE transactions SET tag = 'other' WHERE tag = ?", (name,))
    db.execute("DELETE FROM tags WHERE name = ?", (name,))
    db.commit()
    return jsonify({"ok": True})
