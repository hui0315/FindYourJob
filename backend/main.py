import json
import re
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel as PydanticBaseModel

from database import init_db, get_db
from models import JobParseRequest, JobData, JobUpdate, UserProfile
from llm_parser import parse_job_text, check_ollama_available, MODEL
from extraction_schema import build_user_prompt, extraction_to_jobdata

app = FastAPI(title="FindYourJob API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

EDUCATION_RANK = {"none": 0, "high_school": 1, "bachelor": 2, "master": 3, "phd": 4}

HOURLY_TO_MONTHLY = 160  # 8 hours/day * 20 days/month


def normalize_salary_to_monthly(amount: int | None, salary_type: str) -> int | None:
    """Convert any salary amount to its monthly equivalent."""
    if amount is None or salary_type == "negotiable":
        return None
    if salary_type == "yearly":
        return amount // 12
    if salary_type == "hourly":
        return amount * HOURLY_TO_MONTHLY
    return amount

JOB_COLUMNS = (
    "title, company, salary_min, salary_max, salary_type, salary_guaranteed_months, "
    "location, job_type, workload, skills, experience_years, "
    "education, remote_type, work_hours, leave_policy, benefits, benefits_structured, "
    "language, source_url, notes, priority, mismatches, raw_text, "
    "field_metadata, edit_history"
)

UPDATABLE_COLUMNS = {
    "title", "company", "salary_min", "salary_max", "salary_type",
    "salary_guaranteed_months",
    "location", "job_type", "workload", "skills", "experience_years",
    "education", "remote_type", "work_hours", "leave_policy",
    "benefits", "benefits_structured", "language",
    "source_url", "notes", "priority",
}


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


# ── Prompt template ────────────────────────────────────

@app.get("/api/prompt-template")
def get_prompt_template():
    return {"prompt": build_user_prompt()}


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


def check_mismatches(job: JobData, profile: UserProfile) -> list[dict]:
    """Compare a job against user profile, return list of mismatch dicts."""
    issues = []

    # Experience check
    if (profile.experience_years is not None
            and job.experience_years is not None
            and job.experience_years > profile.experience_years):
        issues.append({
            "type": "experience",
            "message": f"要求 {job.experience_years} 年經驗，你有 {profile.experience_years} 年",
        })

    # Education check
    if profile.education and job.education:
        user_rank = EDUCATION_RANK.get(profile.education, 0)
        job_rank = EDUCATION_RANK.get(job.education, 0)
        if job_rank > user_rank:
            edu_labels = {
                "high_school": "高中", "bachelor": "大學",
                "master": "碩士", "phd": "博士", "none": "不拘",
            }
            issues.append({
                "type": "education",
                "message": f"要求{edu_labels.get(job.education, job.education)}學歷",
            })

    # Salary check — normalize both sides to monthly before comparing
    if (profile.min_salary is not None
            and job.salary_max is not None
            and job.salary_type != "negotiable"
            and profile.salary_type != "negotiable"):
        job_monthly = normalize_salary_to_monthly(job.salary_max, job.salary_type)
        profile_monthly = normalize_salary_to_monthly(profile.min_salary, profile.salary_type)
        if job_monthly is not None and profile_monthly is not None and job_monthly < profile_monthly:
            salary_type_labels = {"monthly": "月薪", "yearly": "年薪", "hourly": "時薪"}
            job_label = salary_type_labels.get(job.salary_type, job.salary_type)
            profile_label = salary_type_labels.get(profile.salary_type, profile.salary_type)
            issues.append({
                "type": "salary",
                "message": f"薪資上限 {job.salary_max:,}（{job_label}）低於你的期望 {profile.min_salary:,}（{profile_label}）",
            })

    # Location check
    if profile.preferred_locations and job.location:
        prefs = [loc.strip() for loc in profile.preferred_locations.split(",") if loc.strip()]
        if prefs:
            matched = any(pref in job.location or job.location in pref for pref in prefs)
            if not matched:
                issues.append({
                    "type": "location",
                    "message": f"工作地點 {job.location} 不在你的偏好地區",
                })

    return issues


# ── Skill pool ─────────────────────────────────────────

def _normalize_skill(s: str) -> str:
    """Normalize a skill string for consistent matching."""
    return s.strip()


def _split_skills(skills_str: str | None) -> list[str]:
    """Split a comma-separated skills string into a list."""
    if not skills_str:
        return []
    return [_normalize_skill(s) for s in skills_str.split(",") if s.strip()]


@app.get("/api/skills/pool")
def get_skill_pool():
    """Aggregate all unique skills from all jobs, merged with user ratings."""
    with get_db() as conn:
        rows = conn.execute("SELECT skills FROM jobs WHERE skills IS NOT NULL").fetchall()
        # Collect all unique skills
        all_skills: set[str] = set()
        for row in rows:
            all_skills.update(_split_skills(row["skills"]))

        if not all_skills:
            return []

        # Get user ratings
        rated = conn.execute("SELECT skill, status FROM user_skills").fetchall()
        rating_map = {r["skill"]: r["status"] for r in rated}

        result = []
        for skill in sorted(all_skills):
            result.append({
                "skill": skill,
                "status": rating_map.get(skill, "none"),
                "job_count": sum(
                    1 for row in rows if skill in _split_skills(row["skills"])
                ),
            })
        return result


@app.put("/api/skills")
def update_user_skills(updates: dict[str, str]):
    """Batch update user skill statuses. Body: {"React": "known", "Docker": "learning"}"""
    valid = {"known", "learning", "none"}
    with get_db() as conn:
        for skill, status in updates.items():
            if status not in valid:
                continue
            if status == "none":
                conn.execute("DELETE FROM user_skills WHERE skill = ?", (skill,))
            else:
                conn.execute(
                    "INSERT OR REPLACE INTO user_skills (skill, status) VALUES (?, ?)",
                    (skill, status),
                )
    return {"message": "已更新"}


def calc_skill_match(job: JobData, conn) -> dict | None:
    """Calculate skill match percentage for a job."""
    job_skills = _split_skills(job.skills)
    if not job_skills:
        return None

    rated = conn.execute("SELECT skill, status FROM user_skills").fetchall()
    if not rated:
        return None

    rating_map = {r["skill"]: r["status"] for r in rated}

    known = []
    learning = []
    missing = []
    for skill in job_skills:
        status = rating_map.get(skill, "none")
        if status == "known":
            known.append(skill)
        elif status == "learning":
            learning.append(skill)
        else:
            missing.append(skill)

    total = len(job_skills)
    score = (len(known) * 1.0 + len(learning) * 0.5) / total

    return {
        "score": round(score * 100),
        "known": known,
        "learning": learning,
        "missing": missing,
        "total": total,
    }


# ── Jobs CRUD ───────────────────────────────────────────

@app.post("/api/jobs/parse", response_model=list[JobData])
def parse_and_save_jobs(req: JobParseRequest):
    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="文字內容不能為空")

    parsed_jobs = parse_job_text(req.raw_text)
    return _save_jobs_to_db(parsed_jobs)


class JobImportRequest(PydanticBaseModel):
    json_text: str
    raw_text: str = ""


def _clean_json_text(text: str) -> str:
    """Strip markdown code blocks and whitespace from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]  # remove opening ```json
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return text.strip()


_TRACKABLE_FIELDS = {
    "title", "company", "salary_min", "salary_max", "salary_type",
    "salary_guaranteed_months", "location", "job_type", "workload",
    "skills", "experience_years", "education", "remote_type",
    "work_hours", "leave_policy", "benefits", "benefits_structured",
    "language", "source_url", "notes", "priority",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_initial_metadata(job: JobData, source: str) -> dict:
    """Build field_metadata for a newly created job."""
    ts = _now_iso()
    meta = {}
    data = job.model_dump()
    for field in _TRACKABLE_FIELDS:
        if data.get(field) is not None:
            meta[field] = {"source": source, "updated_at": ts}
    return meta


def _save_jobs_to_db(jobs: list[JobData], source: str = "llm") -> list[JobData]:
    """Save a list of JobData to DB with mismatch check and skill match."""
    saved = []
    with get_db() as conn:
        profile = _get_profile(conn)
        for job in jobs:
            mismatches = check_mismatches(job, profile)
            job.mismatches = json.dumps(mismatches, ensure_ascii=False) if mismatches else None

            # Build initial field metadata and edit history
            meta = _build_initial_metadata(job, source)
            job.field_metadata = json.dumps(meta, ensure_ascii=False)
            ts = _now_iso()
            history_entry = {
                "action": "created",
                "timestamp": ts,
                "source": source,
                "fields_updated": list(meta.keys()),
            }
            job.edit_history = json.dumps([history_entry], ensure_ascii=False)

            cursor = conn.execute(
                f"INSERT INTO jobs ({JOB_COLUMNS}) VALUES ({','.join('?' * 25)})",
                (
                    job.title, job.company, job.salary_min, job.salary_max,
                    job.salary_type, job.salary_guaranteed_months,
                    job.location, job.job_type, job.workload,
                    job.skills, job.experience_years, job.education,
                    job.remote_type, job.work_hours, job.leave_policy,
                    job.benefits, job.benefits_structured,
                    job.language, job.source_url, job.notes, job.priority,
                    job.mismatches, job.raw_text,
                    job.field_metadata, job.edit_history,
                ),
            )
            job.id = cursor.lastrowid
            match = calc_skill_match(job, conn)
            if match:
                job.skill_match = json.dumps(match, ensure_ascii=False)
            saved.append(job)
    return saved


@app.post("/api/jobs/import", response_model=list[JobData])
def import_structured_jobs(req: JobImportRequest):
    """Import pre-structured JSON from online LLM (ChatGPT, Gemini, etc.)."""
    cleaned = _clean_json_text(req.json_text)
    if not cleaned:
        raise HTTPException(status_code=400, detail="JSON 內容不能為空")

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"JSON 格式錯誤：{e}")

    # Detect LLM error response (e.g. non-job input)
    if isinstance(parsed, dict) and "error" in parsed:
        raise HTTPException(status_code=400, detail=parsed["error"])

    # Handle single object or array
    if isinstance(parsed, dict):
        if "jobs" in parsed:
            items = parsed["jobs"]
        else:
            items = [parsed]
    elif isinstance(parsed, list):
        items = parsed
    else:
        raise HTTPException(status_code=400, detail="JSON 格式不正確，需要物件或陣列")

    if not items:
        raise HTTPException(status_code=400, detail="沒有找到職缺資料")

    try:
        fallback_raw = req.raw_text or None
        jobs = [
            extraction_to_jobdata(item, fallback_raw or json.dumps(item, ensure_ascii=False))
            for item in items
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"資料驗證失敗：{e}")

    return _save_jobs_to_db(jobs, source="import")


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
        jobs = []
        for row in rows:
            job = JobData(**dict(row))
            match = calc_skill_match(job, conn)
            if match:
                job.skill_match = json.dumps(match, ensure_ascii=False)
            jobs.append(job)
        return jobs


@app.get("/api/jobs/{job_id}", response_model=JobData)
def get_job(job_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此職缺")
        return JobData(**dict(row))


@app.put("/api/jobs/{job_id}", response_model=JobData)
def update_job(job_id: int, update: JobUpdate):
    updates = {k: v for k, v in update.model_dump().items()
               if v is not None and k in UPDATABLE_COLUMNS}
    if not updates:
        raise HTTPException(status_code=400, detail="沒有要更新的欄位")

    with get_db() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此職缺")

        # Update field metadata — mark updated fields as source="user"
        existing_meta = json.loads(row["field_metadata"] or "{}")
        existing_history = json.loads(row["edit_history"] or "[]")
        ts = _now_iso()
        changed_fields = []
        for field in updates:
            if field in _TRACKABLE_FIELDS:
                existing_meta[field] = {"source": "user", "updated_at": ts}
                changed_fields.append(field)

        if changed_fields:
            existing_history.append({
                "action": "manual_edit",
                "timestamp": ts,
                "source": "user",
                "fields_updated": changed_fields,
            })

        updates["field_metadata"] = json.dumps(existing_meta, ensure_ascii=False)
        updates["edit_history"] = json.dumps(existing_history, ensure_ascii=False)

        # Recalculate mismatches
        job_data = dict(row)
        job_data.update(updates)
        job_obj = JobData(**job_data)
        profile = _get_profile(conn)
        mismatches = check_mismatches(job_obj, profile)
        updates["mismatches"] = json.dumps(mismatches, ensure_ascii=False) if mismatches else None

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [job_id]
        conn.execute(f"UPDATE jobs SET {set_clause} WHERE id = ?", values)

        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        job = JobData(**dict(row))
        match = calc_skill_match(job, conn)
        if match:
            job.skill_match = json.dumps(match, ensure_ascii=False)
        return job


class SupplementRequest(PydanticBaseModel):
    raw_text: str = ""
    json_text: str = ""
    method: str = "local"  # "local" | "import"


@app.post("/api/jobs/{job_id}/supplement", response_model=JobData)
def supplement_job(job_id: int, req: SupplementRequest):
    """Parse raw text or import JSON and merge new fields into an existing job."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此職缺")

        existing = dict(row)

        # Parse new data
        if req.method == "import":
            if not req.json_text.strip():
                raise HTTPException(status_code=400, detail="JSON 內容不能為空")
            cleaned = _clean_json_text(req.json_text)
            try:
                parsed = json.loads(cleaned)
            except json.JSONDecodeError as e:
                raise HTTPException(status_code=400, detail=f"JSON 格式錯誤：{e}")
            if isinstance(parsed, dict) and "error" in parsed:
                raise HTTPException(status_code=400, detail=parsed["error"])
            if isinstance(parsed, dict):
                items = [parsed.get("jobs", [parsed])[0]] if "jobs" in parsed else [parsed]
            elif isinstance(parsed, list):
                items = parsed[:1]  # Only take the first for supplement
            else:
                raise HTTPException(status_code=400, detail="JSON 格式不正確")
            if not items:
                raise HTTPException(status_code=400, detail="沒有找到職缺資料")
            try:
                new_job = extraction_to_jobdata(items[0], req.raw_text or json.dumps(items[0], ensure_ascii=False))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"資料驗證失敗：{e}")
            source = "import"
        else:
            if not req.raw_text.strip():
                raise HTTPException(status_code=400, detail="文字內容不能為空")
            parsed_jobs = parse_job_text(req.raw_text)
            if not parsed_jobs:
                raise HTTPException(status_code=400, detail="無法解析出職缺資料")
            new_job = parsed_jobs[0]
            source = "llm"

        # Merge: update existing job with non-null fields from new data
        new_data = new_job.model_dump()
        existing_meta = json.loads(existing.get("field_metadata") or "{}")
        existing_history = json.loads(existing.get("edit_history") or "[]")
        ts = _now_iso()
        updates = {}
        changed_fields = []

        for field in _TRACKABLE_FIELDS:
            new_val = new_data.get(field)
            if new_val is not None:
                updates[field] = new_val
                existing_meta[field] = {"source": source, "updated_at": ts}
                changed_fields.append(field)

        # Append new raw_text to existing
        old_raw = existing.get("raw_text") or ""
        new_raw = req.raw_text.strip() if req.raw_text else ""
        if new_raw:
            updates["raw_text"] = (old_raw + "\n\n---\n\n" + new_raw) if old_raw else new_raw

        if not changed_fields:
            raise HTTPException(status_code=400, detail="解析後沒有新的欄位可更新")

        existing_history.append({
            "action": "supplement",
            "timestamp": ts,
            "source": source,
            "fields_updated": changed_fields,
        })

        updates["field_metadata"] = json.dumps(existing_meta, ensure_ascii=False)
        updates["edit_history"] = json.dumps(existing_history, ensure_ascii=False)

        # Recalculate mismatches
        merged = dict(existing)
        merged.update(updates)
        job_obj = JobData(**{k: merged[k] for k in JobData.model_fields if k in merged})
        profile = _get_profile(conn)
        mismatches = check_mismatches(job_obj, profile)
        updates["mismatches"] = json.dumps(mismatches, ensure_ascii=False) if mismatches else None

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [job_id]
        conn.execute(f"UPDATE jobs SET {set_clause} WHERE id = ?", values)

        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        job = JobData(**dict(row))
        match = calc_skill_match(job, conn)
        if match:
            job.skill_match = json.dumps(match, ensure_ascii=False)
        return job


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
