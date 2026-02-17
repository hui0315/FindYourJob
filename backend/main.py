from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_db
from models import JobParseRequest, JobData, JobUpdate
from mock_parser import parse_job_text

app = FastAPI(title="FindYourJob API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


@app.post("/api/jobs/parse", response_model=list[JobData])
def parse_and_save_jobs(req: JobParseRequest):
    """Parse raw text into structured job data and save to DB."""
    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="文字內容不能為空")

    parsed_jobs = parse_job_text(req.raw_text)

    saved = []
    with get_db() as conn:
        for job in parsed_jobs:
            cursor = conn.execute(
                """INSERT INTO jobs
                   (title, company, salary_min, salary_max, salary_type,
                    location, job_type, workload, skills, source_url, notes, priority, raw_text)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    job.title, job.company, job.salary_min, job.salary_max,
                    job.salary_type, job.location, job.job_type, job.workload,
                    job.skills, job.source_url, job.notes, job.priority, job.raw_text,
                ),
            )
            job.id = cursor.lastrowid
            saved.append(job)

    return saved


@app.get("/api/jobs", response_model=list[JobData])
def list_jobs(sort_by: str = "created_at", order: str = "desc"):
    """List all jobs with sorting support."""
    allowed_sort = {
        "created_at", "title", "company", "salary_min", "salary_max",
        "location", "workload", "priority",
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
