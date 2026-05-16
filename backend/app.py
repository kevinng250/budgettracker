import logging
import os
import sqlite3
import traceback
from flask import Flask, g, jsonify
from flask_cors import CORS
from config import DATABASE, UPLOAD_ARCHIVE_DIR, CORS_ORIGINS

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

DEFAULT_TAGS = [
    "food", "drinks", "gas", "travel", "shopping", "entertainment",
    "utilities", "health", "subscriptions", "income", "transfer", "other",
]

# Ordered list of (category, [tags]) used to seed defaults and assign default tags.
DEFAULT_CATEGORIES = [
    ("Food & Drinks", ["food", "drinks"]),
    ("Transportation", ["gas", "travel"]),
    ("Lifestyle", ["shopping", "entertainment", "subscriptions"]),
    ("Bills & Utilities", ["utilities"]),
    ("Health", ["health"]),
    ("Income", ["income"]),
    ("Transfers", ["transfer"]),
    ("Other", ["other"]),
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
    os.makedirs(UPLOAD_ARCHIVE_DIR, exist_ok=True)
    with app.app_context():
        db = get_db()
        db.executescript("""
            CREATE TABLE IF NOT EXISTS categories (
                name TEXT PRIMARY KEY,
                is_default INTEGER NOT NULL DEFAULT 0,
                position INTEGER NOT NULL DEFAULT 0
            );

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

            CREATE TABLE IF NOT EXISTS labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS transaction_labels (
                transaction_id INTEGER NOT NULL,
                label_id INTEGER NOT NULL,
                PRIMARY KEY (transaction_id, label_id),
                FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
                FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_txn_labels_label ON transaction_labels(label_id);

            CREATE TABLE IF NOT EXISTS receipt_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER NOT NULL,
                description TEXT NOT NULL,
                line_total REAL NOT NULL,
                quantity REAL,
                unit TEXT,
                unit_price REAL,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_receipt_items_txn ON receipt_items(transaction_id);
            CREATE INDEX IF NOT EXISTS idx_receipt_items_desc ON receipt_items(description);

            CREATE TABLE IF NOT EXISTS item_tags (
                name TEXT PRIMARY KEY,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS receipt_item_tags (
                item_id INTEGER NOT NULL,
                tag_name TEXT NOT NULL,
                PRIMARY KEY (item_id, tag_name),
                FOREIGN KEY (item_id) REFERENCES receipt_items(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_name) REFERENCES item_tags(name) ON UPDATE CASCADE ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_receipt_item_tags_tag ON receipt_item_tags(tag_name);

            CREATE TABLE IF NOT EXISTS pending_receipts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_path TEXT,
                extracted_json TEXT NOT NULL,
                warnings_json TEXT,
                merchant TEXT,
                purchase_date TEXT,
                total REAL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)

        # Ensure a seeded default profile exists before backfilling owning tables.
        default_profile_row = db.execute(
            "SELECT id FROM profiles WHERE is_default = 1 LIMIT 1"
        ).fetchone()
        if not default_profile_row:
            existing = db.execute("SELECT id FROM profiles LIMIT 1").fetchone()
            if existing:
                default_profile_id = existing["id"]
            else:
                cursor = db.execute(
                    "INSERT INTO profiles (name, is_default) VALUES (?, 1)", ("Me",)
                )
                default_profile_id = cursor.lastrowid
        else:
            default_profile_id = default_profile_row["id"]

        # Add profile_id column + backfill on each owning table.
        for table in ("transactions", "manual_accounts", "pending_receipts", "upload_log"):
            cols = {row[1] for row in db.execute(f"PRAGMA table_info({table})").fetchall()}
            if "profile_id" not in cols:
                db.execute(
                    f"ALTER TABLE {table} ADD COLUMN profile_id INTEGER REFERENCES profiles(id)"
                )
            db.execute(
                f"UPDATE {table} SET profile_id = ? WHERE profile_id IS NULL",
                (default_profile_id,),
            )
        # Migrations for existing databases
        columns = {row[1] for row in db.execute("PRAGMA table_info(transactions)").fetchall()}
        if "balance" not in columns:
            db.execute("ALTER TABLE transactions ADD COLUMN balance REAL")
        if "parent_id" not in columns:
            db.execute("ALTER TABLE transactions ADD COLUMN parent_id INTEGER REFERENCES transactions(id)")
            db.execute("CREATE INDEX IF NOT EXISTS idx_txn_parent_id ON transactions(parent_id)")
        if "upload_id" not in columns:
            db.execute("ALTER TABLE transactions ADD COLUMN upload_id INTEGER")
            db.execute("CREATE INDEX IF NOT EXISTS idx_txn_upload_id ON transactions(upload_id)")
        if "receipt_image_path" not in columns:
            db.execute("ALTER TABLE transactions ADD COLUMN receipt_image_path TEXT")
        if "transaction_date" not in columns:
            db.execute("ALTER TABLE transactions ADD COLUMN transaction_date TEXT")

        upload_log_columns = {
            row[1] for row in db.execute("PRAGMA table_info(upload_log)").fetchall()
        }
        if "stored_path" not in upload_log_columns:
            db.execute("ALTER TABLE upload_log ADD COLUMN stored_path TEXT")

        tag_columns = {row[1] for row in db.execute("PRAGMA table_info(tags)").fetchall()}
        if "category" not in tag_columns:
            db.execute(
                "ALTER TABLE tags ADD COLUMN category TEXT "
                "REFERENCES categories(name) ON UPDATE CASCADE ON DELETE SET NULL"
            )
        if "is_category" not in tag_columns:
            db.execute(
                "ALTER TABLE tags ADD COLUMN is_category INTEGER NOT NULL DEFAULT 0"
            )

        for tag in DEFAULT_TAGS:
            db.execute(
                "INSERT OR IGNORE INTO tags (name, is_default) VALUES (?, 1)",
                (tag,),
            )

        for position, (category, tag_list) in enumerate(DEFAULT_CATEGORIES):
            db.execute(
                "INSERT OR IGNORE INTO categories (name, is_default, position) VALUES (?, 1, ?)",
                (category, position),
            )
            for tag in tag_list:
                # Only assign default category if tag has no category yet,
                # so user reassignments aren't clobbered on subsequent boots.
                db.execute(
                    "UPDATE tags SET category = ? WHERE name = ? AND category IS NULL",
                    (category, tag),
                )

        # Ensure a synthetic "category tag" exists for each category so users can
        # classify a transaction at the category level directly.
        category_names = [r[0] for r in db.execute("SELECT name FROM categories").fetchall()]
        for cat in category_names:
            db.execute(
                "INSERT OR IGNORE INTO tags (name, is_default, category, is_category) "
                "VALUES (?, 1, ?, 1)",
                (cat, cat),
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
    from routes.categories import bp as categories_bp
    from routes.labels import bp as labels_bp
    from routes.receipts import bp as receipts_bp
    from routes.items import bp as items_bp
    from routes.item_tags import bp as item_tags_bp
    from routes.profiles import bp as profiles_bp
    from routes.summary import bp as summary_bp
    from routes.accounts import bp as accounts_bp

    app.register_blueprint(transactions_bp, url_prefix="/api")
    app.register_blueprint(tags_bp, url_prefix="/api")
    app.register_blueprint(categories_bp, url_prefix="/api")
    app.register_blueprint(labels_bp, url_prefix="/api")
    app.register_blueprint(receipts_bp, url_prefix="/api")
    app.register_blueprint(items_bp, url_prefix="/api")
    app.register_blueprint(item_tags_bp, url_prefix="/api")
    app.register_blueprint(profiles_bp, url_prefix="/api")
    app.register_blueprint(summary_bp, url_prefix="/api")
    app.register_blueprint(accounts_bp, url_prefix="/api")

    return app


if __name__ == "__main__":
    app = create_app()
    # Bind on all interfaces so the phone (via Tailscale or LAN) can reach the dev server.
    app.run(debug=True, port=5001, host="0.0.0.0")
