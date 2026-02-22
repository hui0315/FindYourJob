import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "jobs.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                salary_min INTEGER,
                salary_max INTEGER,
                salary_type TEXT DEFAULT 'monthly',
                salary_guaranteed_months INTEGER,
                location TEXT,
                job_type TEXT,
                workload TEXT,
                skills TEXT,
                experience_years INTEGER,
                education TEXT,
                remote_type TEXT,
                work_hours TEXT,
                leave_policy TEXT,
                benefits TEXT,
                benefits_structured TEXT,
                language TEXT,
                source_url TEXT,
                notes TEXT,
                priority INTEGER DEFAULT 3,
                mismatches TEXT,
                raw_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Migrate existing databases: add new columns if missing
        existing = {
            row[1] for row in conn.execute("PRAGMA table_info(jobs)").fetchall()
        }
        migrations = {
            "salary_guaranteed_months": "INTEGER",
            "leave_policy": "TEXT",
            "benefits_structured": "TEXT",
            "language": "TEXT",
        }
        for col, col_type in migrations.items():
            if col not in existing:
                conn.execute(f"ALTER TABLE jobs ADD COLUMN {col} {col_type}")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                experience_years INTEGER,
                education TEXT,
                skills TEXT,
                preferred_locations TEXT,
                min_salary INTEGER,
                salary_type TEXT DEFAULT 'monthly'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_skills (
                skill TEXT PRIMARY KEY,
                status TEXT DEFAULT 'none' CHECK (status IN ('known', 'learning', 'none'))
            )
        """)
        # Ensure exactly one profile row exists
        conn.execute("""
            INSERT OR IGNORE INTO user_profile (id) VALUES (1)
        """)
