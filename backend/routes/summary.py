from flask import Blueprint, request, jsonify
from app import get_db

bp = Blueprint("summary", __name__)


@bp.route("/summary/by-tag", methods=["GET"])
def spending_by_tag():
    db = get_db()
    conditions = ["tag NOT IN ('transfer', 'income')"]
    params = []

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    mode = request.args.get("mode", "gross")  # "gross" or "net"

    if date_from:
        conditions.append("date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("date <= ?")
        params.append(date_to)

    if mode == "gross":
        conditions.append("amount > 0")

    where = f"WHERE {' AND '.join(conditions)}"
    rows = db.execute(
        f"SELECT tag, SUM(amount) as total, COUNT(*) as count "
        f"FROM transactions {where} GROUP BY tag ORDER BY total DESC",
        params,
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/summary/over-time", methods=["GET"])
def spending_over_time():
    db = get_db()
    conditions = ["tag NOT IN ('transfer', 'income')"]
    params = []

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    granularity = request.args.get("granularity", "month")
    mode = request.args.get("mode", "gross")

    if date_from:
        conditions.append("date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("date <= ?")
        params.append(date_to)

    if mode == "gross":
        conditions.append("amount > 0")

    if granularity == "day":
        period_expr = "date"
    elif granularity == "week":
        period_expr = "strftime('%Y-W%W', date)"
    else:
        period_expr = "strftime('%Y-%m', date)"

    where = f"WHERE {' AND '.join(conditions)}"
    rows = db.execute(
        f"SELECT {period_expr} as period, SUM(amount) as total, COUNT(*) as count "
        f"FROM transactions {where} GROUP BY period ORDER BY period",
        params,
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/summary/income-vs-spending", methods=["GET"])
def income_vs_spending():
    db = get_db()
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

    base_conditions = ["tag NOT IN ('transfer')"]
    params = []
    if date_from:
        base_conditions.append("date >= ?")
        params.append(date_from)
    if date_to:
        base_conditions.append("date <= ?")
        params.append(date_to)

    where = f"WHERE {' AND '.join(base_conditions)}"
    period_expr = "strftime('%Y-%m', date)"

    rows = db.execute(
        f"SELECT {period_expr} as period, "
        f"SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as spending, "
        f"SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as income "
        f"FROM transactions {where} GROUP BY period ORDER BY period",
        params,
    ).fetchall()

    result = []
    for r in rows:
        spending = r["spending"] or 0
        income = r["income"] or 0
        result.append({
            "period": r["period"],
            "spending": round(spending, 2),
            "income": round(income, 2),
            "difference": round(income - spending, 2),
        })
    return jsonify(result)
