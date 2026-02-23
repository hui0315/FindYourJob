import sqlite3
import json
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "jobs.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
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
        # ── Companies table ─────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                benefits TEXT,
                benefits_structured TEXT,
                contact_name TEXT,
                contact_title TEXT,
                contact_phone TEXT,
                contact_email TEXT,
                address TEXT,
                website TEXT,
                notes TEXT,
                interview_process TEXT,
                interview_questions TEXT,
                ai_notes TEXT,
                industry TEXT,
                company_size TEXT,
                culture TEXT,
                raw_text TEXT,
                field_metadata TEXT,
                edit_history TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Jobs table ──────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                company_id INTEGER REFERENCES companies(id),
                salary_min INTEGER,
                salary_max INTEGER,
                salary_type TEXT DEFAULT 'monthly',
                salary_guaranteed_months INTEGER,
                location TEXT,
                job_type TEXT,
                workload TEXT,
                description TEXT,
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
                field_metadata TEXT,
                edit_history TEXT,
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
            "field_metadata": "TEXT",
            "edit_history": "TEXT",
            "company_id": "INTEGER REFERENCES companies(id)",
            "description": "TEXT",
        }
        for col, col_type in migrations.items():
            if col not in existing:
                conn.execute(f"ALTER TABLE jobs ADD COLUMN {col} {col_type}")

        # Migrate existing databases: add new columns to companies if missing
        existing_company_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(companies)").fetchall()
        }
        company_migrations = {
            "interview_process": "TEXT",
            "interview_questions": "TEXT",
            "ai_notes": "TEXT",
            "industry": "TEXT",
            "company_size": "TEXT",
            "culture": "TEXT",
            "raw_text": "TEXT",
            "field_metadata": "TEXT",
            "edit_history": "TEXT",
        }
        for col, col_type in company_migrations.items():
            if col not in existing_company_cols:
                conn.execute(f"ALTER TABLE companies ADD COLUMN {col} {col_type}")

        # ── User profile & skills tables ────────────────────
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

        # ── Migrate existing jobs → companies ───────────────
        _migrate_jobs_to_companies(conn)


def _migrate_jobs_to_companies(conn):
    """One-time migration: create company records from existing jobs that lack company_id."""
    orphan_rows = conn.execute(
        "SELECT id, company, benefits, benefits_structured FROM jobs WHERE company_id IS NULL"
    ).fetchall()

    if not orphan_rows:
        return

    # Group by company name
    by_company: dict[str, list[dict]] = {}
    for row in orphan_rows:
        name = row["company"]
        if name not in by_company:
            by_company[name] = []
        by_company[name].append(dict(row))

    for company_name, job_rows in by_company.items():
        # Check if company already exists
        existing = conn.execute(
            "SELECT id FROM companies WHERE name = ?", (company_name,)
        ).fetchone()

        if existing:
            company_id = existing["id"]
        else:
            # Pick the richest benefits from among the jobs
            best_bs = None
            best_bs_count = 0
            best_benefits_text = None
            for jr in job_rows:
                bs_str = jr.get("benefits_structured")
                if bs_str:
                    try:
                        bs = json.loads(bs_str)
                        count = sum(len(v) for v in bs.values() if isinstance(v, list))
                        if count > best_bs_count:
                            best_bs_count = count
                            best_bs = bs_str
                    except (json.JSONDecodeError, TypeError):
                        pass
                if not best_benefits_text and jr.get("benefits"):
                    best_benefits_text = jr["benefits"]

            cursor = conn.execute(
                "INSERT INTO companies (name, benefits, benefits_structured) VALUES (?, ?, ?)",
                (company_name, best_benefits_text, best_bs),
            )
            company_id = cursor.lastrowid

        # Link all jobs for this company
        job_ids = [jr["id"] for jr in job_rows]
        placeholders = ",".join("?" * len(job_ids))
        conn.execute(
            f"UPDATE jobs SET company_id = ? WHERE id IN ({placeholders})",
            [company_id] + job_ids,
        )

        # Clear job-level benefits (they now live on the company)
        conn.execute(
            f"UPDATE jobs SET benefits = NULL, benefits_structured = NULL WHERE id IN ({placeholders})",
            job_ids,
        )
