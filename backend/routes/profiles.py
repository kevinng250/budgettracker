"""Profile CRUD — household members whose financial data is segregated.

Per the design, profiles are a *segregation* concept (no auth), not a login
concept. Per-profile owning tables: transactions, manual_accounts,
pending_receipts, upload_log.
"""

from flask import Blueprint, jsonify, request

from app import get_db

bp = Blueprint("profiles", __name__)

OWNING_TABLES = ("transactions", "manual_accounts", "pending_receipts", "upload_log")


def _row_count(db, table: str, profile_id: int) -> int:
    return db.execute(
        f"SELECT COUNT(*) FROM {table} WHERE profile_id = ?", (profile_id,)
    ).fetchone()[0]


@bp.route("/profiles", methods=["GET"])
def list_profiles():
    db = get_db()
    rows = db.execute(
        "SELECT id, name, color, is_default, created_at FROM profiles "
        "ORDER BY is_default DESC, name"
    ).fetchall()
    profiles = [dict(r) for r in rows]
    # Attach row counts per owning table for the management UI.
    for p in profiles:
        p["counts"] = {t: _row_count(db, t, p["id"]) for t in OWNING_TABLES}
    return jsonify(profiles)


@bp.route("/profiles", methods=["POST"])
def create_profile():
    db = get_db()
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Profile name is required"}), 400
    color = (data.get("color") or None)
    if isinstance(color, str):
        color = color.strip() or None
    existing = db.execute("SELECT 1 FROM profiles WHERE name = ?", (name,)).fetchone()
    if existing:
        return jsonify({"error": f"Profile '{name}' already exists"}), 409
    cursor = db.execute(
        "INSERT INTO profiles (name, color, is_default) VALUES (?, ?, 0)",
        (name, color),
    )
    db.commit()
    return jsonify({
        "id": cursor.lastrowid,
        "name": name,
        "color": color,
        "is_default": 0,
    }), 201


@bp.route("/profiles/<int:profile_id>", methods=["PATCH"])
def update_profile(profile_id):
    db = get_db()
    profile = db.execute(
        "SELECT * FROM profiles WHERE id = ?", (profile_id,)
    ).fetchone()
    if not profile:
        return jsonify({"error": "Profile not found"}), 404
    data = request.get_json() or {}
    fields = []
    values: list = []
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Name is required"}), 400
        if name != profile["name"]:
            clash = db.execute(
                "SELECT 1 FROM profiles WHERE name = ? AND id != ?",
                (name, profile_id),
            ).fetchone()
            if clash:
                return jsonify({"error": f"Profile '{name}' already exists"}), 409
        fields.append("name = ?")
        values.append(name)
    if "color" in data:
        color = data.get("color")
        if isinstance(color, str):
            color = color.strip() or None
        fields.append("color = ?")
        values.append(color)
    if not fields:
        return jsonify({"error": "No updatable fields provided"}), 400
    values.append(profile_id)
    db.execute(f"UPDATE profiles SET {', '.join(fields)} WHERE id = ?", values)
    db.commit()
    row = db.execute(
        "SELECT id, name, color, is_default, created_at FROM profiles WHERE id = ?",
        (profile_id,),
    ).fetchone()
    return jsonify(dict(row))


@bp.route("/profiles/<int:profile_id>", methods=["DELETE"])
def delete_profile(profile_id):
    db = get_db()
    profile = db.execute(
        "SELECT * FROM profiles WHERE id = ?", (profile_id,)
    ).fetchone()
    if not profile:
        return jsonify({"error": "Profile not found"}), 404
    if profile["is_default"]:
        return jsonify({"error": "Cannot delete the default profile"}), 400
    # Block deletion when any owning row references this profile.
    for table in OWNING_TABLES:
        count = _row_count(db, table, profile_id)
        if count > 0:
            return jsonify({
                "error": (
                    f"Profile '{profile['name']}' has {count} row(s) in {table}. "
                    "Reassign or delete those first."
                )
            }), 409
    db.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    db.commit()
    return jsonify({"ok": True})
