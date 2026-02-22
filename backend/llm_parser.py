"""
LLM-based job parser using Ollama (local Qwen2.5-3B).
Falls back to regex-based mock_parser when Ollama is unavailable.
"""

import json
import logging
import os
import httpx
from models import JobData

logger = logging.getLogger(__name__)

OLLAMA_BASE = os.environ.get("OLLAMA_BASE", "http://localhost:11434")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")

SYSTEM_PROMPT = """你是一個職缺資訊萃取助手。使用者會貼上一段或多段職缺描述文字，請從中萃取結構化資料。

回傳格式必須是一個 JSON 陣列，每個元素代表一筆職缺，包含以下欄位：

【基本資訊】
- title: 職位名稱 (string, 必填)
- company: 公司名稱 (string, 必填，找不到填 "未知公司")
- location: 工作地點 (string 或 null)
- job_type: "full-time" | "part-time" | "contract" | "intern" | null
- remote_type: 遠端類型 (string 或 null): "onsite" | "hybrid" | "remote"

【薪資待遇】
- salary_min: 最低薪資數字 (integer 或 null)
- salary_max: 最高薪資數字 (integer 或 null)
- salary_type: "monthly" | "yearly" | "hourly" | "negotiable"
- salary_guaranteed_months: 保障年薪月數 (integer 或 null，例如 "保障14個月" → 14，"年終2個月" → 14)

【福利制度】(參考人力銀行分類方式)
- benefits: 福利摘要，逗號分隔 (string 或 null，向下相容用)
- benefits_structured: 結構化福利 (object 或 null)，格式：
  {
    "bonus": ["年終獎金", "三節獎金", "績效獎金", ...],
    "insurance": ["團體保險", ...],
    "leave": ["特休優於勞基法", ...],
    "subsidy": ["旅遊補助", "進修補助", ...],
    "system": ["教育訓練", "績效考核", ...],
    "other": ["員工旅遊", "免費零食", ...]
  }
  分類說明：
  - bonus（獎金類）：年終獎金、三節獎金/禮品、生日禮金、績效獎金、全勤獎金、員工分紅、股票選擇權
  - insurance（保險類）：團體保險、意外險（勞健保為法定不用列）
  - leave（休假類）：特休優於勞基法、彈性假、有薪病假
  - subsidy（補助類）：旅遊補助、結婚補助、生育補助、進修補助、交通補助、住房補助、餐費補助、健檢補助
  - system（制度類）：教育訓練、員工持股、彈性上下班
  - other（其他）：員工旅遊、部門聚餐、免費零食、健身房、尾牙

【工作條件】
- workload: "light" | "moderate" | "heavy" | null
- skills: 技能需求，逗號分隔 (string 或 null)
- experience_years: 最低工作年資 (integer 或 null，"3年以上" → 3，"不拘" → 0)
- education: "high_school" | "bachelor" | "master" | "phd" | "none" | null
- work_hours: 上班時間描述 (string 或 null，例如 "09:00-18:00")
- leave_policy: 休假制度 (string 或 null，例如 "週休二日"、"排班制"、"見紅休")
- language: 語文條件 (string 或 null，例如 "英文中等以上"、"日文N2")

【其他】
- source_url: 來源網址 (string 或 null)
- notes: 其他值得注意的資訊 (string 或 null)

規則：
- 薪資一律轉成數字，例如 "50K" → 50000, "5萬" → 50000
- 如果薪資寫「面議」，salary_min 和 salary_max 設為 null，salary_type 設為 "negotiable"
- 保障年薪月數：若只提到「年終N個月」，則 salary_guaranteed_months = 12 + N
- benefits_structured 只放文字中明確提及的福利，不要自行推測
- 如果文字包含多筆職缺（用空行、分隔線等區隔），回傳多個元素
- 只回傳 JSON 陣列，不要有其他文字"""


def check_ollama_available() -> bool:
    """Check if Ollama is running and the model is available."""
    try:
        resp = httpx.get(f"{OLLAMA_BASE}/api/tags", timeout=3)
        if resp.status_code != 200:
            return False
        models = [m["name"] for m in resp.json().get("models", [])]
        # Check for exact match or match without tag suffix
        return any(MODEL in m for m in models)
    except (httpx.ConnectError, httpx.TimeoutException):
        return False


def parse_with_ollama(raw_text: str) -> list[JobData]:
    """Parse job text using Ollama local LLM."""
    resp = httpx.post(
        f"{OLLAMA_BASE}/api/chat",
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": raw_text},
            ],
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 2048,
            },
        },
        timeout=60,
    )
    resp.raise_for_status()

    content = resp.json()["message"]["content"]
    parsed = json.loads(content)

    # Handle both single object and array responses
    if isinstance(parsed, dict):
        # Model returned a single object, might be wrapped
        if "jobs" in parsed:
            items = parsed["jobs"]
        else:
            items = [parsed]
    elif isinstance(parsed, list):
        items = parsed
    else:
        raise ValueError(f"Unexpected response format: {type(parsed)}")

    jobs = []
    for item in items:
        # Serialize benefits_structured to JSON string if it's a dict
        benefits_struct = item.get("benefits_structured")
        if isinstance(benefits_struct, dict):
            benefits_struct = json.dumps(benefits_struct, ensure_ascii=False)

        jobs.append(JobData(
            title=item.get("title", "未知職位"),
            company=item.get("company", "未知公司"),
            salary_min=_safe_int(item.get("salary_min")),
            salary_max=_safe_int(item.get("salary_max")),
            salary_type=item.get("salary_type", "monthly"),
            salary_guaranteed_months=_safe_int(item.get("salary_guaranteed_months")),
            location=item.get("location"),
            job_type=item.get("job_type"),
            workload=item.get("workload"),
            skills=item.get("skills"),
            experience_years=_safe_int(item.get("experience_years")),
            education=item.get("education"),
            remote_type=item.get("remote_type"),
            work_hours=item.get("work_hours"),
            leave_policy=item.get("leave_policy"),
            benefits=item.get("benefits"),
            benefits_structured=benefits_struct,
            language=item.get("language"),
            source_url=item.get("source_url"),
            notes=item.get("notes"),
            raw_text=raw_text,
        ))

    return jobs


def _safe_int(val) -> int | None:
    """Safely convert a value to int, returning None on failure."""
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def parse_job_text(raw_text: str) -> list[JobData]:
    """
    Main entry point: try Ollama first, fall back to regex parser.
    """
    if check_ollama_available():
        try:
            logger.info("Using Ollama (%s) for parsing", MODEL)
            return parse_with_ollama(raw_text)
        except Exception as e:
            logger.warning("Ollama parsing failed, falling back to regex: %s", e)

    # Fallback to regex-based parser
    logger.info("Using regex fallback parser")
    from mock_parser import parse_job_text as regex_parse
    return regex_parse(raw_text)
