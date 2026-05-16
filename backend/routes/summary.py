from flask import Blueprint, request, jsonify
from app import get_db

bp = Blueprint("summary", __name__)

# Exclude split parents from all aggregations to avoid double-counting
EXCLUDE_SPLIT_PARENTS = (
    "transactions.id NOT IN (SELECT DISTINCT parent_id FROM transactions WHERE parent_id IS NOT NULL)"
)


def _category_filter_sql(category, params):
    """
    Append a category filter clause and params. Treats 'Uncategorized' as NULL.
    Returns the SQL fragment to add to WHERE (caller already JOINs tags).
    """
    if category == "Uncategorized":
        return "tags.category IS NULL"
    params.append(category)
    return "tags.category = ?"


@bp.route("/summary/by-tag", methods=["GET"])
def spending_by_tag():
    """
    Modes:
    - gross: spending after refunds (all amounts, excluding transfers & income tags)
    - income: money coming in (only transactions tagged 'income')

    group_by:
    - tag (default): group by transactions.tag
    - category: group by COALESCE(tags.category, 'Uncategorized')
    """
    db = get_db()
    params = []
    mode = request.args.get("mode", "gross")
    group_by = request.args.get("group_by", "tag")

    if mode == "income":
        conditions = ["transactions.tag = 'income'", EXCLUDE_SPLIT_PARENTS]
    else:
        conditions = ["transactions.tag NOT IN ('transfer', 'income')", EXCLUDE_SPLIT_PARENTS]

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    profile_id = request.args.get("profile_id")

    if date_from:
        conditions.append("transactions.date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("transactions.date <= ?")
        params.append(date_to)
    if profile_id:
        conditions.append("transactions.profile_id = ?")
        params.append(int(profile_id))

    where = f"WHERE {' AND '.join(conditions)}"

    if group_by == "category":
        rows = db.execute(
            f"SELECT COALESCE(tags.category, 'Uncategorized') as tag, "
            f"SUM(transactions.amount) as total, COUNT(*) as count "
            f"FROM transactions LEFT JOIN tags ON transactions.tag = tags.name "
            f"{where} GROUP BY COALESCE(tags.category, 'Uncategorized') ORDER BY total DESC",
            params,
        ).fetchall()
    elif mode == "income":
        rows = db.execute(
            f"SELECT transactions.description as tag, SUM(ABS(transactions.amount)) as total, COUNT(*) as count "
            f"FROM transactions {where} GROUP BY transactions.description ORDER BY total DESC",
            params,
        ).fetchall()
    else:
        rows = db.execute(
            f"SELECT transactions.tag as tag, SUM(transactions.amount) as total, COUNT(*) as count "
            f"FROM transactions {where} GROUP BY transactions.tag ORDER BY total DESC",
            params,
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/summary/over-time", methods=["GET"])
def spending_over_time():
    db = get_db()
    params = []
    granularity = request.args.get("granularity", "month")
    mode = request.args.get("mode", "gross")
    category = request.args.get("category")

    if mode == "income":
        conditions = ["transactions.tag = 'income'", EXCLUDE_SPLIT_PARENTS]
    else:
        conditions = ["transactions.tag NOT IN ('transfer', 'income')", EXCLUDE_SPLIT_PARENTS]

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    profile_id = request.args.get("profile_id")

    if date_from:
        conditions.append("transactions.date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("transactions.date <= ?")
        params.append(date_to)
    if profile_id:
        conditions.append("transactions.profile_id = ?")
        params.append(int(profile_id))

    join = ""
    if category:
        join = "LEFT JOIN tags ON transactions.tag = tags.name"
        conditions.append(_category_filter_sql(category, params))

    if granularity == "day":
        period_expr = "transactions.date"
    elif granularity == "week":
        period_expr = "strftime('%Y-W%W', transactions.date)"
    else:
        period_expr = "strftime('%Y-%m', transactions.date)"

    where = f"WHERE {' AND '.join(conditions)}"
    amount_expr = "SUM(ABS(transactions.amount))" if mode == "income" else "SUM(transactions.amount)"
    rows = db.execute(
        f"SELECT {period_expr} as period, {amount_expr} as total, COUNT(*) as count "
        f"FROM transactions {join} {where} GROUP BY period ORDER BY period",
        params,
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/summary/income-vs-spending", methods=["GET"])
def income_vs_spending():
    db = get_db()
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    category = request.args.get("category")
    profile_id = request.args.get("profile_id")

    params = []
    date_conditions = []
    if date_from:
        date_conditions.append("transactions.date >= ?")
        params.append(date_from)
    if date_to:
        date_conditions.append("transactions.date <= ?")
        params.append(date_to)
    if profile_id:
        date_conditions.append("transactions.profile_id = ?")
        params.append(int(profile_id))

    date_where = (" AND " + " AND ".join(date_conditions)) if date_conditions else ""
    period_expr = "strftime('%Y-%m', transactions.date)"

    # Spending side respects the category filter; income side does not.
    if category:
        spending_clause = (
            "CASE WHEN transactions.tag NOT IN ('transfer', 'income') AND ("
            + ("tags.category IS NULL" if category == "Uncategorized" else "tags.category = ?")
            + ") THEN transactions.amount ELSE 0 END"
        )
        if category != "Uncategorized":
            params.append(category)
        join = "LEFT JOIN tags ON transactions.tag = tags.name"
    else:
        spending_clause = "CASE WHEN transactions.tag NOT IN ('transfer', 'income') THEN transactions.amount ELSE 0 END"
        join = ""

    rows = db.execute(
        f"SELECT {period_expr} as period, "
        f"SUM({spending_clause}) as spending, "
        f"SUM(CASE WHEN transactions.tag = 'income' THEN ABS(transactions.amount) ELSE 0 END) as income "
        f"FROM transactions {join} "
        f"WHERE transactions.tag NOT IN ('transfer') AND {EXCLUDE_SPLIT_PARENTS}{date_where} "
        f"GROUP BY period ORDER BY period",
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
