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
    source_url: Optional[str] = None
    notes: Optional[str] = None
    priority: int = 3  # 1-5, 1=highest
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
    source_url: Optional[str] = None
    notes: Optional[str] = None
    priority: Optional[int] = None
