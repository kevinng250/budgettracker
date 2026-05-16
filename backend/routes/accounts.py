from flask import Blueprint, request, jsonify
from app import get_db

bp = Blueprint("accounts", __name__)


@bp.route("/account-balances", methods=["GET"])
def account_balances():
    """Get current balance for all accounts that have balance data."""
    db = get_db()
    profile_id = request.args.get("profile_id")

    # Get the balance from the most recent transaction (by date, then by row order) per account
    txn_extra = ""
    txn_params: list = []
    if profile_id:
        txn_extra = " AND t.profile_id = ?"
        txn_params.append(int(profile_id))
    txn_balances = db.execute(
        f"SELECT t.bank, t.account, t.balance, t.date, 'transaction' as source "
        f"FROM transactions t "
        f"WHERE t.balance IS NOT NULL{txn_extra} "
        f"AND NOT EXISTS ("
        f"  SELECT 1 FROM transactions t2 "
        f"  WHERE t2.bank = t.bank AND t2.account = t.account "
        f"  AND t2.balance IS NOT NULL "
        f"  AND (t2.date > t.date OR (t2.date = t.date AND t2.id > t.id))"
        f") "
        f"ORDER BY t.bank, t.account",
        txn_params,
    ).fetchall()

    # Get manual accounts
    manual_extra = ""
    manual_params: list = []
    if profile_id:
        manual_extra = " WHERE profile_id = ?"
        manual_params.append(int(profile_id))
    manual = db.execute(
        f"SELECT bank, account, balance, updated_at as date, 'manual' as source "
        f"FROM manual_accounts{manual_extra} ORDER BY bank, account",
        manual_params,
    ).fetchall()

    results = [dict(r) for r in txn_balances] + [dict(r) for r in manual]
    return jsonify(results)


@bp.route("/manual-accounts", methods=["GET"])
def list_manual_accounts():
    db = get_db()
    profile_id = request.args.get("profile_id")
    if profile_id:
        rows = db.execute(
            "SELECT * FROM manual_accounts WHERE profile_id = ? ORDER BY bank, account",
            (int(profile_id),),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM manual_accounts ORDER BY bank, account"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/manual-accounts", methods=["POST"])
def create_manual_account():
    db = get_db()
    data = request.get_json() or {}
    bank = (data.get("bank") or "").strip()
    account = (data.get("account") or "").strip()
    balance = data.get("balance", 0)
    profile_id = data.get("profile_id")
    if not bank or not account:
        return jsonify({"error": "Bank and account are required"}), 400
    if profile_id is None:
        return jsonify({"error": "profile_id is required"}), 400
    try:
        profile_id = int(profile_id)
    except (TypeError, ValueError):
        return jsonify({"error": "profile_id must be an integer"}), 400
    cursor = db.execute(
        "INSERT INTO manual_accounts (bank, account, balance, profile_id) VALUES (?, ?, ?, ?)",
        (bank, account, float(balance), profile_id),
    )
    db.commit()
    row = db.execute("SELECT * FROM manual_accounts WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@bp.route("/manual-accounts/<int:acct_id>", methods=["PATCH"])
def update_manual_account(acct_id):
    db = get_db()
    data = request.get_json()
    balance = data.get("balance")
    if balance is None:
        return jsonify({"error": "Balance is required"}), 400
    db.execute(
        "UPDATE manual_accounts SET balance = ?, updated_at = datetime('now') WHERE id = ?",
        (float(balance), acct_id),
    )
    db.commit()
    row = db.execute("SELECT * FROM manual_accounts WHERE id = ?", (acct_id,)).fetchone()
    if not row:
        return jsonify({"error": "Account not found"}), 404
    return jsonify(dict(row))


@bp.route("/manual-accounts/<int:acct_id>", methods=["DELETE"])
def delete_manual_account(acct_id):
    db = get_db()
    db.execute("DELETE FROM manual_accounts WHERE id = ?", (acct_id,))
    db.commit()
    return jsonify({"ok": True})
