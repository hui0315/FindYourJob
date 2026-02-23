import json
import re
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel as PydanticBaseModel

from database import init_db, get_db
from models import (
    JobParseRequest, JobData, JobUpdate,
    CompanyData, CompanyUpdate, UserProfile,
)
from llm_parser import parse_job_text, check_ollama_available, MODEL
from extraction_schema import (
    build_user_prompt, extraction_to_jobdata,
    build_company_user_prompt, extraction_to_companydata,
)
from company_normalizer import normalize as normalize_company, invalidate_embedding_cache

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
    "title, company, company_id, salary_min, salary_max, salary_type, salary_guaranteed_months, "
    "location, job_type, workload, description, skills, experience_years, "
    "education, remote_type, work_hours, leave_policy, benefits, benefits_structured, "
    "language, source_url, notes, priority, mismatches, raw_text, "
    "field_metadata, edit_history"
)

UPDATABLE_COLUMNS = {
    "title", "company", "company_id",
    "salary_min", "salary_max", "salary_type",
    "salary_guaranteed_months",
    "location", "job_type", "workload", "description",
    "skills", "experience_years",
    "education", "remote_type", "work_hours", "leave_policy",
    "benefits", "benefits_structured", "language",
    "source_url", "notes", "priority",
}

COMPANY_COLUMNS = (
    "name, benefits, benefits_structured, "
    "contact_name, contact_title, contact_phone, contact_email, "
    "address, website, notes, "
    "interview_process, interview_questions, ai_notes, "
    "industry, company_size, culture"
)

UPDATABLE_COMPANY_COLUMNS = {
    "name", "benefits", "benefits_structured",
    "contact_name", "contact_title", "contact_phone", "contact_email",
    "address", "website", "notes",
    "interview_process", "interview_questions", "ai_notes",
    "industry", "company_size", "culture",
}

_COMPANY_TRACKABLE_FIELDS = {
    "name", "benefits", "benefits_structured",
    "contact_name", "contact_title", "contact_phone", "contact_email",
    "address", "website", "notes",
    "interview_process", "interview_questions", "ai_notes",
    "industry", "company_size", "culture",
}

_COMPANY_FIELD_LABELS = {
    "name": "公司名稱", "benefits": "福利", "benefits_structured": "結構化福利",
    "contact_name": "聯絡人", "contact_title": "聯絡人職稱",
    "contact_phone": "電話", "contact_email": "Email",
    "address": "公司地址", "website": "公司網站", "notes": "備註",
    "interview_process": "面試流程", "interview_questions": "考古題",
    "ai_notes": "AI 備註", "industry": "產業別",
    "company_size": "公司規模", "culture": "工作文化",
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


# ── Company helpers ────────────────────────────────────

def _find_or_create_company(conn, company_name: str, company_info: dict | None = None) -> int:
    """Find an existing company by name (with fuzzy/embedding matching), or create a new one.

    Uses the 3-layer normalization pipeline:
    1. Exact match on preprocessed name
    2. rapidfuzz fuzzy match (if installed)
    3. sentence-transformers embedding match (if installed)

    company_info may contain: contact_name, contact_title, contact_phone,
    contact_email, address, website, plus benefits/benefits_structured
    from the extraction.

    Returns the company ID.
    """
    result = normalize_company(company_name, conn)

    if result.company_id is not None and not result.needs_review:
        # Confident match → use existing company
        if company_info:
            _fill_company_nulls(conn, result.company_id, company_info)
        return result.company_id

    if result.company_id is not None and result.needs_review:
        # Matched but needs review — still link to the candidate for now,
        # but the needs_review flag will surface in the API response
        if company_info:
            _fill_company_nulls(conn, result.company_id, company_info)
        return result.company_id

    # No match → create new company
    info = company_info or {}
    cursor = conn.execute(
        f"INSERT INTO companies ({COMPANY_COLUMNS}) VALUES ({','.join('?' * 16)})",
        (
            company_name,
            info.get("benefits"),
            info.get("benefits_structured"),
            info.get("contact_name"),
            info.get("contact_title"),
            info.get("contact_phone"),
            info.get("contact_email"),
            info.get("address"),
            info.get("website"),
            info.get("notes"),
            info.get("interview_process"),
            info.get("interview_questions"),
            info.get("ai_notes"),
            info.get("industry"),
            info.get("company_size"),
            info.get("culture"),
        ),
    )
    return cursor.lastrowid


def _fill_company_nulls(conn, company_id: int, info: dict):
    """Update NULL fields on an existing company with new values (non-destructive)."""
    row = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not row:
        return

    updates = {}
    for field in UPDATABLE_COMPANY_COLUMNS:
        if field == "name":
            continue  # never overwrite company name
        new_val = info.get(field)
        if new_val is not None and row[field] is None:
            updates[field] = new_val

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [company_id]
        conn.execute(f"UPDATE companies SET {set_clause} WHERE id = ?", values)


def _row_to_company(row, conn=None) -> CompanyData:
    """Convert a DB row to CompanyData, optionally computing job_count."""
    data = dict(row)
    company = CompanyData(**{k: data[k] for k in CompanyData.model_fields if k in data})
    if conn is not None:
        count = conn.execute(
            "SELECT COUNT(*) as cnt FROM jobs WHERE company_id = ?", (company.id,)
        ).fetchone()
        company.job_count = count["cnt"] if count else 0
    return company


# ── Companies CRUD ─────────────────────────────────────

@app.get("/api/companies", response_model=list[CompanyData])
def list_companies():
    """List all companies with their job counts."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM companies ORDER BY name ASC"
        ).fetchall()
        return [_row_to_company(row, conn) for row in rows]


@app.get("/api/companies/prompt-template")
def get_company_prompt_template():
    """Return the user-facing prompt for company data extraction."""
    return {"prompt": build_company_user_prompt()}


@app.get("/api/companies/{company_id}", response_model=CompanyData)
def get_company(company_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此公司")
        return _row_to_company(row, conn)


@app.put("/api/companies/{company_id}", response_model=CompanyData)
def update_company(company_id: int, update: CompanyUpdate):
    updates = {k: v for k, v in update.model_dump().items()
               if v is not None and k in UPDATABLE_COMPANY_COLUMNS}
    if not updates:
        raise HTTPException(status_code=400, detail="沒有要更新的欄位")

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此公司")

        # If renaming, check for duplicates
        if "name" in updates and updates["name"] != row["name"]:
            existing = conn.execute(
                "SELECT id FROM companies WHERE name = ? AND id != ?",
                (updates["name"], company_id),
            ).fetchone()
            if existing:
                raise HTTPException(status_code=409, detail="已有同名公司")
            # Also update company name on linked jobs
            conn.execute(
                "UPDATE jobs SET company = ? WHERE company_id = ?",
                (updates["name"], company_id),
            )
            # Invalidate embedding cache for old name
            invalidate_embedding_cache(row["name"])

        # Track field metadata and edit history
        existing_meta = json.loads(row["field_metadata"] or "{}") if row["field_metadata"] else {}
        existing_history = json.loads(row["edit_history"] or "[]") if row["edit_history"] else []
        ts = _now_iso()
        changed_fields = []
        for field in updates:
            if field in _COMPANY_TRACKABLE_FIELDS:
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

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [company_id]
        conn.execute(f"UPDATE companies SET {set_clause} WHERE id = ?", values)

        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        return _row_to_company(row, conn)


@app.delete("/api/companies/{company_id}")
def delete_company(company_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此公司")

        # Unlink jobs (set company_id to NULL), don't delete them
        conn.execute(
            "UPDATE jobs SET company_id = NULL WHERE company_id = ?",
            (company_id,),
        )
        conn.execute("DELETE FROM companies WHERE id = ?", (company_id,))
        invalidate_embedding_cache(row["name"])
        return {"message": "已刪除公司（相關職缺已取消關聯）"}


@app.get("/api/companies/{company_id}/jobs", response_model=list[JobData])
def list_company_jobs(company_id: int):
    """List all jobs for a specific company."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此公司")

        company_data = _row_to_company(row, conn)
        job_rows = conn.execute(
            "SELECT * FROM jobs WHERE company_id = ? ORDER BY created_at DESC",
            (company_id,),
        ).fetchall()

        jobs = []
        for jr in job_rows:
            job = JobData(**dict(jr))
            job.company_data = company_data
            match = calc_skill_match(job, conn)
            if match:
                job.skill_match = json.dumps(match, ensure_ascii=False)
            jobs.append(job)
        return jobs


# ── Company name normalization ─────────────────────────

class CompanyNormalizeRequest(PydanticBaseModel):
    name: str


@app.post("/api/companies/normalize")
def normalize_company_name(req: CompanyNormalizeRequest):
    """Preview company name normalization result.

    Returns the 3-layer pipeline result so the frontend can:
    - Show the matched canonical name
    - Display confidence and method
    - Let the user confirm or override when needs_review=True
    """
    with get_db() as conn:
        result = normalize_company(req.name, conn)
        return {
            "canonical_name": result.canonical_name,
            "company_id": result.company_id,
            "confidence": round(result.confidence, 3),
            "method": result.method,
            "needs_review": result.needs_review,
            "preprocessed": result.preprocessed,
            "candidates": result.candidates,
        }


# ── Company supplement (AI enrichment) ─────────────────

class CompanySupplementRequest(PydanticBaseModel):
    raw_text: str = ""
    json_text: str = ""
    method: str = "import"  # "import" only (no local model for company-only text)
    selected_fields: list[str] | None = None


def _parse_company_supplement_input(req: CompanySupplementRequest) -> tuple[CompanyData, str]:
    """Parse company supplement request. Returns (parsed_company, source_type)."""
    if not req.json_text.strip():
        raise HTTPException(status_code=400, detail="JSON 內容不能為空")
    cleaned = _clean_json_text(req.json_text)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"JSON 格式錯誤：{e}")
    if isinstance(parsed, dict) and "error" in parsed:
        raise HTTPException(status_code=400, detail=parsed["error"])
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="JSON 格式不正確，需要一個物件")
    try:
        company = extraction_to_companydata(
            parsed, req.raw_text or json.dumps(parsed, ensure_ascii=False)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"資料驗證失敗：{e}")
    return company, "import"


@app.post("/api/companies/{company_id}/supplement/preview")
def preview_company_supplement(company_id: int, req: CompanySupplementRequest):
    """Parse new company data and return conflicts/new fields without saving."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此公司")

        existing = dict(row)
        new_company, source = _parse_company_supplement_input(req)
        new_data = new_company.model_dump()

        conflicts = []
        new_fields = []
        for field in _COMPANY_TRACKABLE_FIELDS:
            new_val = new_data.get(field)
            if new_val is None:
                continue
            old_val = existing.get(field)
            if old_val is not None and old_val != new_val:
                conflicts.append({
                    "field": field,
                    "label": _COMPANY_FIELD_LABELS.get(field, field),
                    "old_value": old_val,
                    "new_value": new_val,
                })
            elif old_val is None:
                new_fields.append({
                    "field": field,
                    "label": _COMPANY_FIELD_LABELS.get(field, field),
                    "new_value": new_val,
                })

        return {
            "source": source,
            "conflicts": conflicts,
            "new_fields": new_fields,
        }


@app.post("/api/companies/{company_id}/supplement", response_model=CompanyData)
def supplement_company(company_id: int, req: CompanySupplementRequest):
    """Parse and merge new company data into an existing company record."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此公司")

        existing = dict(row)
        new_company, source = _parse_company_supplement_input(req)
        new_data = new_company.model_dump()

        # Determine which fields to update
        allowed = set(req.selected_fields) if req.selected_fields else None

        existing_meta = json.loads(existing.get("field_metadata") or "{}")
        existing_history = json.loads(existing.get("edit_history") or "[]")
        ts = _now_iso()
        updates = {}
        changed_fields = []

        for field in _COMPANY_TRACKABLE_FIELDS:
            new_val = new_data.get(field)
            if new_val is None:
                continue
            if allowed is not None and field not in allowed:
                continue
            updates[field] = new_val
            existing_meta[field] = {"source": source, "updated_at": ts}
            changed_fields.append(field)

        # Append raw_text
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

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [company_id]
        conn.execute(f"UPDATE companies SET {set_clause} WHERE id = ?", values)

        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (company_id,)
        ).fetchone()
        return _row_to_company(row, conn)


# ── Jobs CRUD ───────────────────────────────────────────

@app.post("/api/jobs/parse", response_model=list[JobData])
def parse_and_save_jobs(req: JobParseRequest):
    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="文字內容不能為空")

    parsed_results = parse_job_text(req.raw_text)
    return _save_jobs_to_db(parsed_results)


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
    "description", "skills", "experience_years", "education", "remote_type",
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


def _save_jobs_to_db(
    parsed_results: list[tuple[JobData, dict]],
    source: str = "llm",
) -> list[JobData]:
    """Save a list of (JobData, company_info) tuples to DB.

    For each job:
    1. Find or create a company record
    2. If the company is new, move job benefits → company benefits
    3. If the company already exists and has benefits, keep job benefits as extras
    4. Link job to company via company_id
    """
    saved = []
    with get_db() as conn:
        profile = _get_profile(conn)

        for job, company_info in parsed_results:
            # ── Company linkage ──
            # Merge extracted benefits into company_info for new companies
            company_info_with_benefits = dict(company_info)
            company_info_with_benefits["benefits"] = job.benefits
            company_info_with_benefits["benefits_structured"] = job.benefits_structured

            company_id = _find_or_create_company(
                conn, job.company, company_info_with_benefits
            )
            job.company_id = company_id

            # Check if the company already has benefits
            company_row = conn.execute(
                "SELECT benefits_structured FROM companies WHERE id = ?",
                (company_id,),
            ).fetchone()
            company_has_benefits = (
                company_row
                and company_row["benefits_structured"] is not None
            )

            if company_has_benefits:
                # Company already has benefits → job benefits become extras
                # Keep job.benefits and job.benefits_structured as-is (extras)
                # But if the job benefits are identical to company benefits, clear them
                if job.benefits_structured == company_row["benefits_structured"]:
                    job.benefits = None
                    job.benefits_structured = None
            else:
                # Company is new or has no benefits → move job benefits to company
                if job.benefits_structured or job.benefits:
                    conn.execute(
                        "UPDATE companies SET benefits = ?, benefits_structured = ? WHERE id = ?",
                        (job.benefits, job.benefits_structured, company_id),
                    )
                    # Clear job-level benefits (now on company)
                    job.benefits = None
                    job.benefits_structured = None

            # ── Mismatch check ──
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
                f"INSERT INTO jobs ({JOB_COLUMNS}) VALUES ({','.join('?' * 26)})",
                (
                    job.title, job.company, job.company_id,
                    job.salary_min, job.salary_max,
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

            # Attach company data for response
            c_row = conn.execute(
                "SELECT * FROM companies WHERE id = ?", (company_id,)
            ).fetchone()
            if c_row:
                job.company_data = _row_to_company(c_row)

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
        results = [
            extraction_to_jobdata(item, fallback_raw or json.dumps(item, ensure_ascii=False))
            for item in items
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"資料驗證失敗：{e}")

    return _save_jobs_to_db(results, source="import")


def _load_job_with_company(row, conn) -> JobData:
    """Load a JobData from a DB row and attach its CompanyData."""
    job = JobData(**dict(row))
    if job.company_id:
        c_row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (job.company_id,)
        ).fetchone()
        if c_row:
            job.company_data = _row_to_company(c_row)
    match = calc_skill_match(job, conn)
    if match:
        job.skill_match = json.dumps(match, ensure_ascii=False)
    return job


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
        return [_load_job_with_company(row, conn) for row in rows]


@app.get("/api/jobs/{job_id}", response_model=JobData)
def get_job(job_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此職缺")
        return _load_job_with_company(row, conn)


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

        # If company name changed, use normalizer for smart matching
        if "company" in updates and updates["company"] != row["company"]:
            norm_result = normalize_company(updates["company"], conn)
            if norm_result.company_id is not None:
                updates["company_id"] = norm_result.company_id
                # Use the canonical name for consistency
                updates["company"] = norm_result.canonical_name
            else:
                new_company_id = _find_or_create_company(conn, updates["company"])
                updates["company_id"] = new_company_id

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
        job_obj = JobData(**{k: job_data[k] for k in JobData.model_fields if k in job_data})
        profile = _get_profile(conn)
        mismatches = check_mismatches(job_obj, profile)
        updates["mismatches"] = json.dumps(mismatches, ensure_ascii=False) if mismatches else None

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [job_id]
        conn.execute(f"UPDATE jobs SET {set_clause} WHERE id = ?", values)

        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return _load_job_with_company(row, conn)


class SupplementRequest(PydanticBaseModel):
    raw_text: str = ""
    json_text: str = ""
    method: str = "local"  # "local" | "import"
    selected_fields: list[str] | None = None  # If set, only update these fields


# Field labels for conflict UI
_FIELD_LABELS = {
    "title": "職位名稱", "company": "公司名稱",
    "salary_min": "最低薪資", "salary_max": "最高薪資",
    "salary_type": "薪資類型", "salary_guaranteed_months": "保障月數",
    "location": "工作地點", "job_type": "工作類型", "workload": "工作量",
    "description": "工作內容",
    "skills": "技能需求", "experience_years": "經驗年數",
    "education": "學歷要求", "remote_type": "遠端類型",
    "work_hours": "上班時間", "leave_policy": "休假制度",
    "benefits": "福利", "benefits_structured": "結構化福利",
    "language": "語文條件", "source_url": "來源連結",
    "notes": "備註", "priority": "優先順序",
}


def _parse_supplement_input(req: SupplementRequest) -> tuple[JobData, dict, str]:
    """Parse supplement request data. Returns (parsed_job, company_info, source_type)."""
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
            items = parsed[:1]
        else:
            raise HTTPException(status_code=400, detail="JSON 格式不正確")
        if not items:
            raise HTTPException(status_code=400, detail="沒有找到職缺資料")
        try:
            new_job, company_info = extraction_to_jobdata(
                items[0], req.raw_text or json.dumps(items[0], ensure_ascii=False)
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"資料驗證失敗：{e}")
        return new_job, company_info, "import"
    else:
        if not req.raw_text.strip():
            raise HTTPException(status_code=400, detail="文字內容不能為空")
        parsed_results = parse_job_text(req.raw_text)
        if not parsed_results:
            raise HTTPException(status_code=400, detail="無法解析出職缺資料")
        job, company_info = parsed_results[0]
        return job, company_info, "llm"


@app.post("/api/jobs/{job_id}/supplement/preview")
def preview_supplement(job_id: int, req: SupplementRequest):
    """Parse new data and return conflicts/new fields without saving."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此職缺")

        existing = dict(row)
        new_job, company_info, source = _parse_supplement_input(req)
        new_data = new_job.model_dump()

        conflicts = []
        new_fields = []
        for field in _TRACKABLE_FIELDS:
            new_val = new_data.get(field)
            if new_val is None:
                continue
            old_val = existing.get(field)
            if old_val is not None and old_val != new_val:
                conflicts.append({
                    "field": field,
                    "label": _FIELD_LABELS.get(field, field),
                    "old_value": old_val,
                    "new_value": new_val,
                })
            elif old_val is None:
                new_fields.append({
                    "field": field,
                    "label": _FIELD_LABELS.get(field, field),
                    "new_value": new_val,
                })

        return {
            "source": source,
            "conflicts": conflicts,
            "new_fields": new_fields,
        }


@app.post("/api/jobs/{job_id}/supplement", response_model=JobData)
def supplement_job(job_id: int, req: SupplementRequest):
    """Parse raw text or import JSON and merge new fields into an existing job."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="找不到此職缺")

        existing = dict(row)
        new_job, company_info, source = _parse_supplement_input(req)
        new_data = new_job.model_dump()

        # Update company contact info if we got new data
        if company_info and existing.get("company_id"):
            _fill_company_nulls(conn, existing["company_id"], company_info)

        # Determine which fields to update
        allowed = set(req.selected_fields) if req.selected_fields else None

        existing_meta = json.loads(existing.get("field_metadata") or "{}")
        existing_history = json.loads(existing.get("edit_history") or "[]")
        ts = _now_iso()
        updates = {}
        changed_fields = []

        for field in _TRACKABLE_FIELDS:
            new_val = new_data.get(field)
            if new_val is None:
                continue
            if allowed is not None and field not in allowed:
                continue
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
        return _load_job_with_company(row, conn)


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
