from pydantic import BaseModel, field_validator
from typing import Optional


class JobParseRequest(BaseModel):
    raw_text: str

    @field_validator("raw_text")
    @classmethod
    def validate_length(cls, v: str) -> str:
        if len(v) > 50000:
            raise ValueError("文字內容不能超過 50,000 字元")
        return v


# ── Company models ─────────────────────────────────────


class CompanyData(BaseModel):
    id: Optional[int] = None
    name: str
    benefits: Optional[str] = None  # legacy free-text
    benefits_structured: Optional[str] = None  # JSON: {bonus:[], insurance:[], ...}
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    interview_process: Optional[str] = None  # 面試流程
    interview_questions: Optional[str] = None  # 考古題 (JSON list)
    ai_notes: Optional[str] = None  # AI 整理的備註/分析
    industry: Optional[str] = None  # 產業別
    company_size: Optional[str] = None  # 公司規模
    culture: Optional[str] = None  # 工作文化
    raw_text: Optional[str] = None
    field_metadata: Optional[str] = None  # JSON: {field: {source, updated_at}}
    edit_history: Optional[str] = None  # JSON: [{action, timestamp, source, fields_updated}]
    created_at: Optional[str] = None
    job_count: Optional[int] = None  # computed at read time


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    benefits: Optional[str] = None
    benefits_structured: Optional[str] = None
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    interview_process: Optional[str] = None
    interview_questions: Optional[str] = None
    ai_notes: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    culture: Optional[str] = None


# ── Job models ─────────────────────────────────────────


class JobData(BaseModel):
    id: Optional[int] = None
    title: str
    company: str
    company_id: Optional[int] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_type: str = "monthly"  # monthly, yearly, hourly, negotiable
    salary_guaranteed_months: Optional[int] = None  # 保障年薪月數 (e.g., 14)
    location: Optional[str] = None
    city: Optional[str] = None
    job_type: Optional[str] = None  # full-time, part-time, contract, intern
    workload: Optional[str] = None  # light, moderate, heavy
    description: Optional[str] = None  # 工作內容（條列）
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None  # high_school, bachelor, master, phd, none
    remote_type: Optional[str] = None  # onsite, hybrid, remote
    work_hours: Optional[str] = None
    leave_policy: Optional[str] = None  # 休假制度: 週休二日, 排班制, etc.
    benefits: Optional[str] = None  # job-specific extra benefits (text)
    benefits_structured: Optional[str] = None  # job-specific extra benefits (JSON)
    language: Optional[str] = None  # 語文條件
    source_url: Optional[str] = None
    notes: Optional[str] = None
    status: str = "not_applied"  # not_applied, applied, interviewing, offered, rejected
    priority: int = 3  # 1-5, 1=highest
    mismatches: Optional[str] = None  # JSON string of mismatch reasons
    skill_match: Optional[str] = None  # JSON: {score, known, learning, missing, total}
    raw_text: Optional[str] = None
    field_metadata: Optional[str] = None  # JSON: {field: {source, updated_at}}
    edit_history: Optional[str] = None    # JSON: [{action, timestamp, source, fields_updated}]
    created_at: Optional[str] = None
    # Company data (populated at read time via JOIN, not stored in jobs table)
    company_data: Optional[CompanyData] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    company_id: Optional[int] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_type: Optional[str] = None
    salary_guaranteed_months: Optional[int] = None
    location: Optional[str] = None
    city: Optional[str] = None
    job_type: Optional[str] = None
    workload: Optional[str] = None
    description: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    remote_type: Optional[str] = None
    work_hours: Optional[str] = None
    leave_policy: Optional[str] = None
    benefits: Optional[str] = None
    benefits_structured: Optional[str] = None
    language: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None


class MismatchItem(BaseModel):
    type: str   # "salary" | "experience" | "education" | "location"
    message: str


class UserProfile(BaseModel):
    experience_years: Optional[int] = None
    education: Optional[str] = None  # high_school, bachelor, master, phd
    skills: Optional[str] = None
    preferred_locations: Optional[str] = None
    min_salary: Optional[int] = None
    salary_type: str = "monthly"
