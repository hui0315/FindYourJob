import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_db
from models import JobParseRequest, JobData, JobUpdate, UserProfile
from llm_parser import parse_job_text, check_ollama_available, MODEL

app = FastAPI(title="FindYourJob API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

EDUCATION_RANK = {"none": 0, "high_school": 1, "bachelor": 2, "master": 3, "phd": 4}

JOB_COLUMNS = (
    "title, company, salary_min, salary_max, salary_type, "
    "location, job_type, workload, skills, experience_years, "
    "education, remote_type, work_hours, benefits, "
    "source_url, notes, priority, mismatches, raw_text"
)


@app.on_event("startup")
def startup():
    init_db()


# ── Status ──────────────────────────────────────────────

@app.get("/api/status")
def get_status():
    ollama_ok = check_ollama_available()
    return {
        "ollama_available": ollama_ok,
        "model": MODEL if ollama_ok else None,
        "parser": "llm" if ollama_ok else "regex",
    }


# ── Profile ─────────────────────────────────────────────

@app.get("/api/profile", response_model=UserProfile)
def get_profile():
    with get_db() as conn:
        row = conn.execute("SELECT * FROM user_profile WHERE id = 1").fetchone()
        if not row:
            return UserProfile()
        return UserProfile(**{k: row[k] for k in UserProfile.model_fields})


@app.put("/api/profile", response_model=UserProfile)
def update_profile(profile: UserProfile):
    with get_db() as conn:
        conn.execute(
            """UPDATE user_profile SET
               experience_years = ?, education = ?, skills = ?,
               preferred_locations = ?, min_salary = ?, salary_type = ?
               WHERE id = 1""",
            (
                profile.experience_years, profile.education, profile.skills,
                profile.preferred_locations, profile.min_salary, profile.salary_type,
            ),
        )
    return profile


# ── Mismatch checking ──────────────────────────────────

def _get_profile(conn) -> UserProfile:
    row = conn.execute("SELECT * FROM user_profile WHERE id = 1").fetchone()
    if not row:
        return UserProfile()
    return UserProfile(**{k: row[k] for k in UserProfile.model_fields})


def check_mismatches(job: JobData, profile: UserProfile) -> list[str]:
    """Compare a job against user profile, return list of mismatch descriptions."""
    issues = []

    # Experience check
    if (profile.experience_years is not None
            and job.experience_years is not None
            and job.experience_years > profile.experience_years):
        issues.append(
            f"要求 {job.experience_years} 年經驗，你有 {profile.experience_years} 年"
        )

    # Education check
    if profile.education and job.education:
        user_rank = EDUCATION_RANK.get(profile.education, 0)
        job_rank = EDUCATION_RANK.get(job.education, 0)
        if job_rank > user_rank:
            edu_labels = {
                "high_school": "高中", "bachelor": "大學",
                "master": "碩士", "phd": "博士", "none": "不拘",
            }
            issues.append(
                f"要求{edu_labels.get(job.education, job.education)}學歷"
            )

    # Salary check
    if (profile.min_salary is not None
            and job.salary_max is not None
            and job.salary_type != "negotiable"
            and job.salary_max < profile.min_salary):
        issues.append(
            f"薪資上限 {job.salary_max:,} 低於你的期望 {profile.min_salary:,}"
        )

    return issues


# ── Jobs CRUD ───────────────────────────────────────────

@app.post("/api/jobs/parse", response_model=list[JobData])
def parse_and_save_jobs(req: JobParseRequest):
    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="文字內容不能為空")

    parsed_jobs = parse_job_text(req.raw_text)

    saved = []
    with get_db() as conn:
        profile = _get_profile(conn)
        for job in parsed_jobs:
            mismatches = check_mismatches(job, profile)
            job.mismatches = json.dumps(mismatches, ensure_ascii=False) if mismatches else None

            cursor = conn.execute(
                f"INSERT INTO jobs ({JOB_COLUMNS}) VALUES ({','.join('?' * 19)})",
                (
                    job.title, job.company, job.salary_min, job.salary_max,
                    job.salary_type, job.location, job.job_type, job.workload,
                    job.skills, job.experience_years, job.education,
                    job.remote_type, job.work_hours, job.benefits,
                    job.source_url, job.notes, job.priority,
                    job.mismatches, job.raw_text,
                ),
            )
            job.id = cursor.lastrowid
            saved.append(job)

    return saved


@app.get("/api/jobs", response_model=list[JobData])
def list_jobs(sort_by: str = "created_at", order: str = "desc"):
    allowed_sort = {
        "created_at", "title", "company", "salary_min", "salary_max",
        "location", "workload", "priority", "experience_years", "education",
    }
    if sort_by not in allowed_sort:
        sort_by = "created_at"
    if order not in ("asc", "desc"):
        order = "desc"

    with get_db() as conn:
        rows = conn.execute(
            f"SELECT * FROM jobs ORDER BY {sort_by} {order}"
        ).fetchall()
        return [JobData(**dict(row)) for row in rows]


@app.get("/api/jobs/{job_id}", response_model=JobData)
def get_job(job_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此職缺")
        return JobData(**dict(row))


@app.put("/api/jobs/{job_id}", response_model=JobData)
def update_job(job_id: int, update: JobUpdate):
    updates = {k: v for k, v in update.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="沒有要更新的欄位")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [job_id]

    with get_db() as conn:
        conn.execute(f"UPDATE jobs SET {set_clause} WHERE id = ?", values)
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此職缺")
        return JobData(**dict(row))


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int):
    with get_db() as conn:
        result = conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="找不到此職缺")
        return {"message": "已刪除"}


@app.delete("/api/jobs")
def delete_all_jobs():
    with get_db() as conn:
        conn.execute("DELETE FROM jobs")
        return {"message": "已清除所有職缺"}
