"""
Regex-based fallback parser for extracting job data from raw text.
Used when Ollama is not available.
"""

import json
import re
from models import JobData


def parse_job_text(raw_text: str) -> list[tuple[JobData, dict]]:
    """Parse raw text and extract job listings using keyword matching.

    Returns list of (JobData, company_info_dict) tuples.
    """
    # Split by common delimiters that might separate multiple jobs
    chunks = re.split(r'\n{3,}|={3,}|-{3,}', raw_text)
    if not chunks or (len(chunks) == 1 and not chunks[0].strip()):
        chunks = [raw_text]

    jobs = []
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        job, company_info = _extract_single_job(chunk)
        if job.title != "未知職位" or job.company != "未知公司":
            jobs.append((job, company_info))

    if not jobs:
        jobs.append(_extract_single_job(raw_text))

    return jobs


def _extract_single_job(text: str) -> tuple[JobData, dict]:
    """Extract a single job's data from text using heuristics.

    Returns (JobData, company_info_dict).
    """
    title = _extract_title(text)
    company = _extract_company(text)
    salary_min, salary_max, salary_type = _extract_salary(text)
    salary_guaranteed_months = _extract_guaranteed_months(text)
    location = _extract_location(text)
    job_type = _extract_job_type(text)
    workload = _extract_workload(text)
    skills = _extract_skills(text)
    experience_years = _extract_experience(text)
    education = _extract_education(text)
    remote_type = _extract_remote_type(text)
    leave_policy = _extract_leave_policy(text)
    benefits_structured = _extract_benefits_structured(text)
    language = _extract_language(text)

    # Extract company contact info
    company_info = _extract_contact_info(text)

    # Build legacy benefits string from structured data
    benefits = None
    if benefits_structured:
        all_items = []
        for items in benefits_structured.values():
            all_items.extend(items)
        if all_items:
            benefits = ", ".join(all_items)

    job = JobData(
        title=title,
        company=company,
        salary_min=salary_min,
        salary_max=salary_max,
        salary_type=salary_type,
        salary_guaranteed_months=salary_guaranteed_months,
        location=location,
        job_type=job_type,
        workload=workload,
        skills=skills,
        experience_years=experience_years,
        education=education,
        remote_type=remote_type,
        leave_policy=leave_policy,
        benefits=benefits,
        benefits_structured=json.dumps(benefits_structured, ensure_ascii=False) if benefits_structured else None,
        language=language,
        raw_text=text,
    )
    return job, company_info


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


def _extract_guaranteed_months(text: str) -> int | None:
    """Extract guaranteed annual salary months (保障年薪月數)."""
    # "保障14個月" or "保障年薪14個月"
    m = re.search(r'保障(?:年薪)?\s*(\d+)\s*個月', text)
    if m:
        return int(m.group(1))
    # "年終N個月" → guaranteed = 12 + N
    m = re.search(r'年終\s*(\d+)\s*個月', text)
    if m:
        return 12 + int(m.group(1))
    return None


def _extract_leave_policy(text: str) -> str | None:
    """Extract leave/holiday policy (休假制度)."""
    patterns = [
        r'(?:休假制度|休假|假別)\s*[:：]\s*(.+)',
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            return m.group(1).strip()
    if re.search(r'週休二日|周休二日', text):
        return "週休二日"
    if re.search(r'排班制', text):
        return "排班制"
    if re.search(r'見紅休', text):
        return "見紅休"
    return None


def _extract_language(text: str) -> str | None:
    """Extract language requirements (語文條件)."""
    patterns = [
        r'(?:語文|語言|外語|Language)\s*[:：]\s*(.+)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    # Detect common language mentions
    langs = []
    if re.search(r'英文|英語|English', text, re.IGNORECASE):
        # Try to find proficiency level
        m = re.search(r'英(?:文|語)\s*(精通|流利|中等|基礎|中上|略懂|聽說讀寫)', text)
        langs.append(f"英文{m.group(1)}" if m else "英文")
    if re.search(r'日文|日語|Japanese|日本語', text, re.IGNORECASE):
        m = re.search(r'日(?:文|語)\s*(?:能力試驗)?\s*[nN]?(\d)', text)
        langs.append(f"日文N{m.group(1)}" if m else "日文")
    return ", ".join(langs) if langs else None


def _extract_benefits_structured(text: str) -> dict | None:
    """Extract structured benefits categorized like 104/1111 job boards."""
    result = {
        "bonus": [],
        "insurance": [],
        "leave": [],
        "subsidy": [],
        "system": [],
        "other": [],
    }

    # Bonus category (獎金類)
    bonus_keywords = {
        "年終獎金": r'年終獎金|年終',
        "三節獎金": r'三節獎金|三節禮金|三節',
        "生日禮金": r'生日禮金|生日禮',
        "績效獎金": r'績效獎金|績效',
        "全勤獎金": r'全勤獎金|全勤',
        "員工分紅": r'員工分紅|分紅',
        "股票選擇權": r'股票選擇權|認股|stock\s*option',
    }
    for label, pat in bonus_keywords.items():
        if re.search(pat, text, re.IGNORECASE):
            result["bonus"].append(label)

    # Insurance category (保險類)
    insurance_keywords = {
        "團體保險": r'團體保險|團保',
        "意外險": r'意外險',
    }
    for label, pat in insurance_keywords.items():
        if re.search(pat, text, re.IGNORECASE):
            result["insurance"].append(label)

    # Leave category (休假類)
    leave_keywords = {
        "特休優於勞基法": r'特休優於|優於勞基法',
        "彈性假": r'彈性假|彈性休假',
        "有薪病假": r'有薪病假|帶薪病假',
    }
    for label, pat in leave_keywords.items():
        if re.search(pat, text, re.IGNORECASE):
            result["leave"].append(label)

    # Subsidy category (補助類)
    subsidy_keywords = {
        "旅遊補助": r'旅遊補助|旅遊津貼',
        "結婚補助": r'結婚補助|結婚禮金',
        "生育補助": r'生育補助|生育津貼',
        "進修補助": r'進修補助|學習補助|教育補助',
        "交通補助": r'交通補助|交通津貼|通勤補助',
        "住房補助": r'住房補助|租屋補助|租屋津貼',
        "餐費補助": r'餐費補助|午餐補助|伙食津貼|伙食費',
        "健檢補助": r'健檢補助|免費健檢|健康檢查',
    }
    for label, pat in subsidy_keywords.items():
        if re.search(pat, text, re.IGNORECASE):
            result["subsidy"].append(label)

    # System category (制度類)
    system_keywords = {
        "教育訓練": r'教育訓練|培訓',
        "員工持股": r'員工持股|持股信託',
        "彈性上下班": r'彈性上下班|彈性工時|flexible\s*hour',
    }
    for label, pat in system_keywords.items():
        if re.search(pat, text, re.IGNORECASE):
            result["system"].append(label)

    # Other category (其他)
    other_keywords = {
        "員工旅遊": r'員工旅遊|公司旅遊',
        "部門聚餐": r'部門聚餐|團隊聚餐',
        "免費零食": r'免費零食|零食飲料|下午茶',
        "健身房": r'健身房|運動設施|gym',
        "尾牙": r'尾牙',
        "員工餐廳": r'員工餐廳',
    }
    for label, pat in other_keywords.items():
        if re.search(pat, text, re.IGNORECASE):
            result["other"].append(label)

    # Only return if we found anything
    has_any = any(items for items in result.values())
    return result if has_any else None


def _extract_contact_info(text: str) -> dict:
    """Extract company contact info from text."""
    info = {}

    # Contact name
    m = re.search(r'(?:聯絡人|聯繫人|Contact)\s*[:：]\s*(.+)', text, re.IGNORECASE)
    if m:
        info["contact_name"] = m.group(1).strip()

    # Contact email
    m = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)
    if m:
        info["contact_email"] = m.group(0)

    # Contact phone
    m = re.search(r'(?:電話|Tel|Phone)\s*[:：]\s*([\d\s()-]+)', text, re.IGNORECASE)
    if m:
        info["contact_phone"] = m.group(1).strip()

    # Company website
    m = re.search(r'(?:網站|Website|官網)\s*[:：]\s*(https?://\S+)', text, re.IGNORECASE)
    if m:
        info["website"] = m.group(1).strip()

    # Company address
    m = re.search(r'(?:公司地址|地址|Address)\s*[:：]\s*(.+)', text, re.IGNORECASE)
    if m:
        info["address"] = m.group(1).strip()

    return info
