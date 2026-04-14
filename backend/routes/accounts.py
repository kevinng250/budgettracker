from flask import Blueprint, request, jsonify
from app import get_db

bp = Blueprint("accounts", __name__)


@bp.route("/account-balances", methods=["GET"])
def account_balances():
    """Get current balance for all accounts that have balance data."""
    db = get_db()

    # Get the balance from the most recent transaction (by date, then by row order) per account
    txn_balances = db.execute(
        "SELECT t.bank, t.account, t.balance, t.date, 'transaction' as source "
        "FROM transactions t "
        "WHERE t.balance IS NOT NULL "
        "AND NOT EXISTS ("
        "  SELECT 1 FROM transactions t2 "
        "  WHERE t2.bank = t.bank AND t2.account = t.account "
        "  AND t2.balance IS NOT NULL "
        "  AND (t2.date > t.date OR (t2.date = t.date AND t2.id > t.id))"
        ") "
        "ORDER BY t.bank, t.account"
    ).fetchall()

    # Get manual accounts
    manual = db.execute(
        "SELECT bank, account, balance, updated_at as date, 'manual' as source "
        "FROM manual_accounts ORDER BY bank, account"
    ).fetchall()

    results = [dict(r) for r in txn_balances] + [dict(r) for r in manual]
    return jsonify(results)


@bp.route("/manual-accounts", methods=["GET"])
def list_manual_accounts():
    db = get_db()
    rows = db.execute("SELECT * FROM manual_accounts ORDER BY bank, account").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/manual-accounts", methods=["POST"])
def create_manual_account():
    db = get_db()
    data = request.get_json()
    bank = data.get("bank", "").strip()
    account = data.get("account", "").strip()
    balance = data.get("balance", 0)
    if not bank or not account:
        return jsonify({"error": "Bank and account are required"}), 400
    cursor = db.execute(
        "INSERT INTO manual_accounts (bank, account, balance) VALUES (?, ?, ?)",
        (bank, account, float(balance)),
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
