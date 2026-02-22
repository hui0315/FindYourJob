"""
Extraction schema — single source of truth for LLM prompt generation.

JobExtraction defines every field the LLM should extract. Field descriptions
are used to auto-generate the system prompt, so adding a field here
automatically updates the prompt without touching llm_parser.py.
"""

import json
from typing import Optional
from pydantic import BaseModel, Field

from models import JobData


# ── Nested model for structured benefits ──────────────────

class BenefitsStructured(BaseModel):
    bonus: list[str] = Field(
        default_factory=list,
        description="獎金類：年終獎金、三節獎金、績效獎金、全勤獎金、員工分紅、股票選擇權",
    )
    insurance: list[str] = Field(
        default_factory=list,
        description="保險類：團體保險、意外險（勞健保為法定不用列）",
    )
    leave: list[str] = Field(
        default_factory=list,
        description="休假類：特休優於勞基法、彈性假、有薪病假",
    )
    subsidy: list[str] = Field(
        default_factory=list,
        description="補助類：旅遊/結婚/生育/進修/交通/住房/餐費/健檢補助",
    )
    system: list[str] = Field(
        default_factory=list,
        description="制度類：教育訓練、員工持股、彈性上下班",
    )
    other: list[str] = Field(
        default_factory=list,
        description="其他：員工旅遊、部門聚餐、免費零食、健身房、尾牙",
    )


# ── Main extraction model ─────────────────────────────────

class JobExtraction(BaseModel):
    """LLM extraction template — each Field(description=...) drives the prompt."""

    title: str = Field(description="職位名稱（必填）")
    company: str = Field(
        default="未知公司",
        description="公司名稱（找不到填「未知公司」）",
    )
    salary_min: Optional[int] = Field(
        None, description="最低薪資數字（50K→50000, 5萬→50000）"
    )
    salary_max: Optional[int] = Field(
        None, description="最高薪資數字"
    )
    salary_type: str = Field(
        default="monthly",
        description="薪資類型：monthly / yearly / hourly / negotiable",
    )
    salary_guaranteed_months: Optional[int] = Field(
        None, description="保障年薪月數（「年終2個月」→ 14）"
    )
    location: Optional[str] = Field(None, description="工作地點")
    job_type: Optional[str] = Field(
        None, description="full-time / part-time / contract / intern"
    )
    workload: Optional[str] = Field(
        None, description="工作強度：light / moderate / heavy"
    )
    skills: Optional[str] = Field(None, description="技能需求，逗號分隔")
    experience_years: Optional[int] = Field(
        None, description="最低工作年資（不拘→0）"
    )
    education: Optional[str] = Field(
        None, description="學歷要求：high_school / bachelor / master / phd / none"
    )
    remote_type: Optional[str] = Field(
        None, description="onsite / hybrid / remote"
    )
    work_hours: Optional[str] = Field(
        None, description="上班時間（如 09:00-18:00）"
    )
    leave_policy: Optional[str] = Field(
        None, description="休假制度（如 週休二日、排班制）"
    )
    benefits: Optional[str] = Field(
        None, description="福利摘要，逗號分隔"
    )
    benefits_structured: Optional[BenefitsStructured] = Field(
        None, description="結構化福利，按六大類分類（只填明確提及的項目）"
    )
    language: Optional[str] = Field(
        None, description="語文條件（如 英文中等以上、日文N2）"
    )
    source_url: Optional[str] = Field(None, description="來源網址")
    notes: Optional[str] = Field(None, description="其他值得注意的資訊")


# ── Auto-generate system prompt from model ─────────────────

def _type_hint(field_info) -> str:
    """Produce a human-readable type hint from a Pydantic FieldInfo."""
    annotation = field_info.annotation

    # Handle Optional[X] (which is Union[X, None])
    origin = getattr(annotation, "__origin__", None)
    if origin is type(None):
        return "null"

    # Optional[int], Optional[str], etc.
    args = getattr(annotation, "__args__", ())
    inner_types = [a for a in args if a is not type(None)]

    if inner_types:
        inner = inner_types[0]
        if inner is int:
            return "integer|null"
        if inner is str:
            return "string|null"
        if inner is BenefitsStructured:
            return "object|null"
        return f"{inner.__name__}|null"

    # Non-optional types
    if annotation is int:
        return "integer"
    if annotation is str:
        return "string"
    return str(annotation)


def _build_template_body() -> str:
    """Generate the JSON template body from JobExtraction model fields."""
    lines = []
    for name, field_info in JobExtraction.model_fields.items():
        type_hint = _type_hint(field_info)
        desc = field_info.description or name
        lines.append(f'  "{name}": "({type_hint}) {desc}"')
    return ",\n".join(lines)


_BENEFITS_EXAMPLE = json.dumps(
    {
        "bonus": ["年終獎金", "績效獎金"],
        "insurance": ["團體保險"],
        "leave": [],
        "subsidy": ["旅遊補助"],
        "system": ["教育訓練"],
        "other": ["員工旅遊"],
    },
    ensure_ascii=False,
    indent=4,
)

_RULES = """規則：
1. 薪資一律轉成數字（50K → 50000, 5萬 → 50000）
2. 面議 → salary_type="negotiable", salary_min 和 salary_max 填 null
3. 保障年薪月數：「年終N個月」→ salary_guaranteed_months = 12 + N
4. benefits_structured 只填文字中明確提及的項目，空的分類用空陣列 []
5. 多筆職缺回傳 JSON 陣列
6. 只回傳 JSON，不要其他文字"""


def build_system_prompt() -> str:
    """Generate system prompt for local Ollama usage."""
    template_body = _build_template_body()
    return f"""你是一個職缺資訊整理助手。請將使用者提供的職缺文字，逐欄位整理填入以下 JSON 格式。
找不到的欄位填 null，不要自行推測。

每筆職缺的格式：
{{
{template_body}
}}

其中 benefits_structured 的格式範例：
{_BENEFITS_EXAMPLE}

{_RULES}"""


def build_user_prompt() -> str:
    """Generate a user-facing prompt for copying into online LLMs (ChatGPT, Gemini, etc.)."""
    template_body = _build_template_body()
    return f"""請幫我把以下的職缺資訊，整理成 JSON 格式。每個欄位根據說明填入，找不到的填 null，不要自行推測。

每筆職缺的 JSON 格式：
{{
{template_body}
}}

其中 benefits_structured 的格式範例：
{_BENEFITS_EXAMPLE}

{_RULES}

以下是需要整理的職缺文字：
"""


# ── Convert extraction result to JobData ──────────────────

def extraction_to_jobdata(item: dict, raw_text: str) -> JobData:
    """Validate an LLM output dict via JobExtraction, then convert to JobData."""
    extracted = JobExtraction.model_validate(item)
    data = extracted.model_dump()

    # Serialize benefits_structured to JSON string for DB storage
    bs = data.pop("benefits_structured", None)
    if bs is not None:
        # Filter out empty categories
        bs = {k: v for k, v in bs.items() if v}
        data["benefits_structured"] = json.dumps(bs, ensure_ascii=False) if bs else None
    else:
        data["benefits_structured"] = None

    data["raw_text"] = raw_text
    return JobData(**data)
