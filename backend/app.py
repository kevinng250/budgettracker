import logging
import os
import sqlite3
import traceback
from flask import Flask, g, jsonify
from flask_cors import CORS
from config import DATABASE, CORS_ORIGINS

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

DEFAULT_TAGS = [
    "food", "drinks", "gas", "travel", "shopping", "entertainment",
    "utilities", "health", "subscriptions", "income", "transfer", "other",
]


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(app):
    os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
    with app.app_context():
        db = get_db()
        db.executescript("""
            CREATE TABLE IF NOT EXISTS tags (
                name TEXT PRIMARY KEY,
                is_default INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                bank TEXT NOT NULL,
                account TEXT NOT NULL,
                tag TEXT NOT NULL DEFAULT 'other',
                balance REAL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (tag) REFERENCES tags(name) ON UPDATE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date);
            CREATE INDEX IF NOT EXISTS idx_txn_tag ON transactions(tag);
            CREATE INDEX IF NOT EXISTS idx_txn_description ON transactions(description);

            CREATE TABLE IF NOT EXISTS manual_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bank TEXT NOT NULL,
                account TEXT NOT NULL,
                balance REAL NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS upload_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                bank TEXT NOT NULL,
                account TEXT NOT NULL,
                date_min TEXT NOT NULL,
                date_max TEXT NOT NULL,
                inserted INTEGER NOT NULL,
                uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
        # Migrations for existing databases
        columns = {row[1] for row in db.execute("PRAGMA table_info(transactions)").fetchall()}
        if "balance" not in columns:
            db.execute("ALTER TABLE transactions ADD COLUMN balance REAL")

        for tag in DEFAULT_TAGS:
            db.execute(
                "INSERT OR IGNORE INTO tags (name, is_default) VALUES (?, 1)",
                (tag,),
            )
        db.commit()
        close_db()


def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error(f"Unhandled exception: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

    app.teardown_appcontext(close_db)
    init_db(app)

    from routes.transactions import bp as transactions_bp
    from routes.tags import bp as tags_bp
    from routes.summary import bp as summary_bp
    from routes.accounts import bp as accounts_bp

    app.register_blueprint(transactions_bp, url_prefix="/api")
    app.register_blueprint(tags_bp, url_prefix="/api")
    app.register_blueprint(summary_bp, url_prefix="/api")
    app.register_blueprint(accounts_bp, url_prefix="/api")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5001)
