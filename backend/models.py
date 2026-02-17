from pydantic import BaseModel
from typing import Optional


class JobParseRequest(BaseModel):
    raw_text: str


class JobData(BaseModel):
    id: Optional[int] = None
    title: str
    company: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_type: str = "monthly"  # monthly, yearly, hourly, negotiable
    location: Optional[str] = None
    job_type: Optional[str] = None  # full-time, part-time, contract, intern
    workload: Optional[str] = None  # light, moderate, heavy
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None  # high_school, bachelor, master, phd, none
    remote_type: Optional[str] = None  # onsite, hybrid, remote
    work_hours: Optional[str] = None
    benefits: Optional[str] = None
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
    location: Optional[str] = None
    job_type: Optional[str] = None
    workload: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    remote_type: Optional[str] = None
    work_hours: Optional[str] = None
    benefits: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    priority: Optional[int] = None


class UserProfile(BaseModel):
    experience_years: Optional[int] = None
    education: Optional[str] = None  # high_school, bachelor, master, phd
    skills: Optional[str] = None
    preferred_locations: Optional[str] = None
    min_salary: Optional[int] = None
    salary_type: str = "monthly"
