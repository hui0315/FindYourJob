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


class JobData(BaseModel):
    id: Optional[int] = None
    title: str
    company: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_type: str = "monthly"  # monthly, yearly, hourly, negotiable
    salary_guaranteed_months: Optional[int] = None  # 保障年薪月數 (e.g., 14)
    location: Optional[str] = None
    job_type: Optional[str] = None  # full-time, part-time, contract, intern
    workload: Optional[str] = None  # light, moderate, heavy
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None  # high_school, bachelor, master, phd, none
    remote_type: Optional[str] = None  # onsite, hybrid, remote
    work_hours: Optional[str] = None
    leave_policy: Optional[str] = None  # 休假制度: 週休二日, 排班制, etc.
    benefits: Optional[str] = None  # legacy free-text
    benefits_structured: Optional[str] = None  # JSON: {bonus:[], insurance:[], leave:[], subsidy:[], system:[], other:[]}
    language: Optional[str] = None  # 語文條件
    source_url: Optional[str] = None
    notes: Optional[str] = None
    priority: int = 3  # 1-5, 1=highest
    mismatches: Optional[str] = None  # JSON string of mismatch reasons
    skill_match: Optional[str] = None  # JSON: {score, known, learning, missing, total}
    raw_text: Optional[str] = None
    created_at: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_type: Optional[str] = None
    salary_guaranteed_months: Optional[int] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    workload: Optional[str] = None
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
