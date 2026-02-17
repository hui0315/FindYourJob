"""
Regex-based fallback parser for extracting job data from raw text.
Used when Ollama is not available.
"""

import re
from models import JobData


def parse_job_text(raw_text: str) -> list[JobData]:
    """Parse raw text and extract job listings using keyword matching."""
    # Split by common delimiters that might separate multiple jobs
    chunks = re.split(r'\n{3,}|={3,}|-{3,}', raw_text)
    if not chunks or (len(chunks) == 1 and not chunks[0].strip()):
        chunks = [raw_text]

    jobs = []
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        job = _extract_single_job(chunk)
        if job.title != "未知職位" or job.company != "未知公司":
            jobs.append(job)

    if not jobs:
        jobs.append(_extract_single_job(raw_text))

    return jobs


def _extract_single_job(text: str) -> JobData:
    """Extract a single job's data from text using heuristics."""
    title = _extract_title(text)
    company = _extract_company(text)
    salary_min, salary_max, salary_type = _extract_salary(text)
    location = _extract_location(text)
    job_type = _extract_job_type(text)
    workload = _extract_workload(text)
    skills = _extract_skills(text)
    experience_years = _extract_experience(text)
    education = _extract_education(text)
    remote_type = _extract_remote_type(text)

    return JobData(
        title=title,
        company=company,
        salary_min=salary_min,
        salary_max=salary_max,
        salary_type=salary_type,
        location=location,
        job_type=job_type,
        workload=workload,
        skills=skills,
        experience_years=experience_years,
        education=education,
        remote_type=remote_type,
        raw_text=text,
    )


def _extract_title(text: str) -> str:
    patterns = [
        r'(?:職位|職稱|Job\s*Title|Position)\s*[:：]\s*(.+)',
        r'(?:徵|招募|招聘)\s*(.+?)\s*(?:\n|$)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    # Fallback: first non-empty line
    for line in text.split('\n'):
        line = line.strip()
        if line and len(line) < 60:
            return line
    return "未知職位"


def _extract_company(text: str) -> str:
    patterns = [
        r'(?:公司|Company|企業|公司名稱)\s*[:：]\s*(.+)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return "未知公司"


def _extract_salary(text: str) -> tuple:
    patterns = [
        r'(?:薪資|薪水|月薪|Salary)\s*[:：]\s*(\d[\d,]*)\s*[-~到至]\s*(\d[\d,]*)',
        r'(?:薪資|薪水|月薪|Salary)\s*[:：]\s*(\d[\d,]*)',
        r'(\d{2,3})[kK]\s*[-~到至]\s*(\d{2,3})[kK]',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            groups = m.groups()
            if 'k' in m.group(0).lower():
                sal_min = int(groups[0]) * 1000
                sal_max = int(groups[1]) * 1000 if len(groups) > 1 else sal_min
            else:
                sal_min = int(groups[0].replace(',', ''))
                sal_max = int(groups[1].replace(',', '')) if len(groups) > 1 else sal_min
            # Determine type
            salary_type = "monthly"
            if re.search(r'年薪|annual|yearly', text, re.IGNORECASE):
                salary_type = "yearly"
            elif re.search(r'時薪|hourly', text, re.IGNORECASE):
                salary_type = "hourly"
            return sal_min, sal_max, salary_type

    if re.search(r'面議|negotiable', text, re.IGNORECASE):
        return None, None, "negotiable"

    return None, None, "monthly"


def _extract_location(text: str) -> str | None:
    patterns = [
        r'(?:地點|地區|Location|工作地點|上班地點)\s*[:：]\s*(.+)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    # Common TW cities
    cities = ['台北', '新北', '桃園', '台中', '台南', '高雄', '新竹', '遠端', 'Remote']
    for city in cities:
        if city.lower() in text.lower():
            return city
    return None


def _extract_job_type(text: str) -> str | None:
    mapping = {
        'full-time': [r'全職', r'full[\s-]?time', r'正職'],
        'part-time': [r'兼職', r'part[\s-]?time'],
        'contract': [r'約聘', r'contract', r'派遣'],
        'intern': [r'實習', r'intern'],
    }
    for jtype, patterns in mapping.items():
        for p in patterns:
            if re.search(p, text, re.IGNORECASE):
                return jtype
    return None


def _extract_workload(text: str) -> str | None:
    if re.search(r'高壓|加班多|heavy|996|高工時', text, re.IGNORECASE):
        return "heavy"
    if re.search(r'正常|moderate|standard|朝九晚六', text, re.IGNORECASE):
        return "moderate"
    if re.search(r'輕鬆|light|彈性|flexible', text, re.IGNORECASE):
        return "light"
    return None


def _extract_skills(text: str) -> str | None:
    patterns = [
        r'(?:技能|Skills|需求技能|Required|條件)\s*[:：]\s*(.+)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    # Try to find common tech keywords
    tech_keywords = [
        'Python', 'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular',
        'Node.js', 'Java', 'C\\+\\+', 'Go', 'Rust', 'SQL', 'AWS', 'Docker',
        'Kubernetes', 'Git', 'Linux', 'MongoDB', 'PostgreSQL', 'Redis',
        'FastAPI', 'Django', 'Flask', 'Spring', 'Next.js',
    ]
    found = []
    for kw in tech_keywords:
        if re.search(r'\b' + kw + r'\b', text, re.IGNORECASE):
            found.append(kw.replace('\\+\\+', '++'))
    return ', '.join(found) if found else None


def _extract_experience(text: str) -> int | None:
    patterns = [
        r'(?:經驗|Experience|年資)\s*[:：]\s*(\d+)\s*年',
        r'(\d+)\s*年以上(?:經驗|工作)',
        r'(\d+)\+?\s*years?',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return int(m.group(1))
    if re.search(r'不拘|無需經驗|no experience|entry[\s-]?level', text, re.IGNORECASE):
        return 0
    return None


def _extract_education(text: str) -> str | None:
    mapping = {
        'phd': [r'博士', r'Ph\.?D'],
        'master': [r'碩士', r'[Mm]aster'],
        'bachelor': [r'大學|大專|學士', r'[Bb]achelor'],
        'high_school': [r'高中|高職', r'[Hh]igh\s*[Ss]chool'],
    }
    for level, patterns in mapping.items():
        for p in patterns:
            if re.search(p, text, re.IGNORECASE):
                return level
    if re.search(r'學歷不拘', text, re.IGNORECASE):
        return "none"
    return None


def _extract_remote_type(text: str) -> str | None:
    if re.search(r'全遠端|fully?\s*remote|100%\s*remote', text, re.IGNORECASE):
        return "remote"
    if re.search(r'混合|hybrid|部分遠端', text, re.IGNORECASE):
        return "hybrid"
    if re.search(r'到班|onsite|on[\s-]?site|進辦公室', text, re.IGNORECASE):
        return "onsite"
    return None
