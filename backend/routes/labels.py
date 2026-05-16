from flask import Blueprint, request, jsonify
from app import get_db

bp = Blueprint("labels", __name__)

# Mirror summary.py: exclude split parents so we count children's individual amounts.
EXCLUDE_SPLIT_PARENTS = (
    "transactions.id NOT IN ("
    "SELECT DISTINCT parent_id FROM transactions WHERE parent_id IS NOT NULL)"
)


def _label_stats_filter():
    """SQL fragment restricting transactions to gross spending (drop transfer/income)."""
    return (
        f"transactions.tag NOT IN ('transfer', 'income') AND {EXCLUDE_SPLIT_PARENTS}"
    )


@bp.route("/labels", methods=["GET"])
def list_labels():
    db = get_db()
    profile_id = request.args.get("profile_id")
    extra = ""
    params: list = []
    if profile_id:
        extra = " AND transactions.profile_id = ?"
        params.append(int(profile_id))
    rows = db.execute(
        "SELECT labels.id, labels.name, "
        "COALESCE(stats.transaction_count, 0) as transaction_count, "
        "COALESCE(stats.total_spent, 0) as total_spent "
        "FROM labels LEFT JOIN ("
        "  SELECT transaction_labels.label_id, "
        "    COUNT(*) as transaction_count, "
        "    SUM(transactions.amount) as total_spent "
        "  FROM transaction_labels "
        "  JOIN transactions ON transactions.id = transaction_labels.transaction_id "
        f" WHERE {_label_stats_filter()}{extra} "
        "  GROUP BY transaction_labels.label_id"
        ") stats ON stats.label_id = labels.id "
        "ORDER BY labels.name",
        params,
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/labels", methods=["POST"])
def create_label():
    db = get_db()
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Label name is required"}), 400
    existing = db.execute("SELECT 1 FROM labels WHERE name = ?", (name,)).fetchone()
    if existing:
        return jsonify({"error": f"Label '{name}' already exists"}), 409
    cursor = db.execute("INSERT INTO labels (name) VALUES (?)", (name,))
    db.commit()
    return jsonify({
        "id": cursor.lastrowid,
        "name": name,
        "transaction_count": 0,
        "total_spent": 0,
    }), 201


@bp.route("/labels/<int:label_id>", methods=["PATCH"])
def rename_label(label_id):
    db = get_db()
    data = request.get_json() or {}
    new_name = (data.get("name") or "").strip()
    if not new_name:
        return jsonify({"error": "New name is required"}), 400
    label = db.execute("SELECT * FROM labels WHERE id = ?", (label_id,)).fetchone()
    if not label:
        return jsonify({"error": "Label not found"}), 404
    if new_name != label["name"]:
        clash = db.execute(
            "SELECT 1 FROM labels WHERE name = ? AND id != ?", (new_name, label_id)
        ).fetchone()
        if clash:
            return jsonify({"error": f"Label '{new_name}' already exists"}), 409
        db.execute("UPDATE labels SET name = ? WHERE id = ?", (new_name, label_id))
        db.commit()
    return jsonify({"id": label_id, "name": new_name})


@bp.route("/labels/<int:label_id>", methods=["DELETE"])
def delete_label(label_id):
    db = get_db()
    label = db.execute("SELECT 1 FROM labels WHERE id = ?", (label_id,)).fetchone()
    if not label:
        return jsonify({"error": "Label not found"}), 404
    db.execute("DELETE FROM labels WHERE id = ?", (label_id,))
    db.commit()
    return jsonify({"ok": True})


@bp.route("/labels/<int:label_id>/summary", methods=["GET"])
def label_summary(label_id):
    db = get_db()
    label = db.execute("SELECT * FROM labels WHERE id = ?", (label_id,)).fetchone()
    if not label:
        return jsonify({"error": "Label not found"}), 404

    params = [label_id]
    date_conditions = []
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    profile_id = request.args.get("profile_id")
    if profile_id:
        date_conditions.append("transactions.profile_id = ?")
        params.append(int(profile_id))
    if date_from:
        date_conditions.append("transactions.date >= ?")
        params.append(date_from)
    if date_to:
        date_conditions.append("transactions.date <= ?")
        params.append(date_to)
    extra = (" AND " + " AND ".join(date_conditions)) if date_conditions else ""

    base_join = (
        "FROM transaction_labels "
        "JOIN transactions ON transactions.id = transaction_labels.transaction_id "
        "LEFT JOIN tags ON transactions.tag = tags.name "
        f"WHERE transaction_labels.label_id = ? AND {_label_stats_filter()}"
        f"{extra}"
    )

    total_row = db.execute(
        f"SELECT COALESCE(SUM(transactions.amount), 0) as total, COUNT(*) as count "
        f"{base_join}", params
    ).fetchone()

    by_tag = db.execute(
        f"SELECT transactions.tag as tag, SUM(transactions.amount) as total, COUNT(*) as count "
        f"{base_join} GROUP BY transactions.tag ORDER BY total DESC",
        params,
    ).fetchall()

    by_category = db.execute(
        f"SELECT COALESCE(tags.category, 'Uncategorized') as tag, "
        f"SUM(transactions.amount) as total, COUNT(*) as count "
        f"{base_join} GROUP BY COALESCE(tags.category, 'Uncategorized') ORDER BY total DESC",
        params,
    ).fetchall()

    return jsonify({
        "label": {"id": label["id"], "name": label["name"]},
        "total": round(total_row["total"] or 0, 2),
        "transaction_count": total_row["count"] or 0,
        "by_tag": [dict(r) for r in by_tag],
        "by_category": [dict(r) for r in by_category],
    })
