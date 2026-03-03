import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INTERACTIONS_DB_PATH = os.path.join(BASE_DIR, "data", "interactions.db")
APP_DB_PATH = os.path.join(BASE_DIR, "data", "app.db")


def get_interactions_db_connection():
    conn = sqlite3.connect(f"file:{INTERACTIONS_DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def get_app_db_connection():
    conn = sqlite3.connect(APP_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_app_db():
    os.makedirs(os.path.dirname(APP_DB_PATH), exist_ok=True)
    conn = get_app_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            is_premium INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    cursor.execute("PRAGMA table_info(users)")
    user_columns = {row[1] for row in cursor.fetchall()}
    if "theme_preference" not in user_columns:
        cursor.execute(
            "ALTER TABLE users ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system'"
        )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            revoked_at INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_usage (
            user_id INTEGER NOT NULL,
            usage_date TEXT NOT NULL,
            check_count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, usage_date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS premium_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
            note TEXT,
            created_at INTEGER NOT NULL,
            reviewed_at INTEGER,
            reviewed_by INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_premium_requests_user_id ON premium_requests(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_premium_requests_status ON premium_requests(status)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_rate_limits (
            identifier TEXT PRIMARY KEY,
            failed_count INTEGER NOT NULL DEFAULT 0,
            first_failed_at INTEGER NOT NULL,
            blocked_until INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_blocked_until ON auth_rate_limits(blocked_until)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS physician_profiles (
            user_id INTEGER PRIMARY KEY,
            physician_name TEXT NOT NULL DEFAULT '',
            physician_email TEXT NOT NULL DEFAULT '',
            physician_notes TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS check_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            check_type TEXT NOT NULL CHECK(check_type IN ('manual', 'ocr')),
            source_language TEXT NOT NULL DEFAULT 'en',
            input_drugs_json TEXT NOT NULL,
            extracted_drugs_json TEXT NOT NULL,
            matched_drugs_json TEXT NOT NULL,
            unmatched_drugs_json TEXT NOT NULL,
            interactions_json TEXT NOT NULL,
            ai_advice_json TEXT,
            physician_summary_json TEXT,
            physician_summary_generated_at INTEGER,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_check_history_user_created ON check_history(user_id, created_at DESC)")

    conn.commit()
    conn.close()
