"""
LLM-based job parser using Ollama (local Qwen2.5-3B).
Falls back to regex-based mock_parser when Ollama is unavailable.

The system prompt is auto-generated from extraction_schema.JobExtraction,
so adding a new field there automatically updates the prompt.
"""

import json
import logging
import os
import httpx
from models import JobData
from extraction_schema import build_system_prompt, extraction_to_jobdata

logger = logging.getLogger(__name__)

OLLAMA_BASE = os.environ.get("OLLAMA_BASE", "http://localhost:11434")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")

# Auto-generated from JobExtraction model — no manual maintenance needed
SYSTEM_PROMPT = build_system_prompt()


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


def parse_with_ollama(raw_text: str) -> list[tuple[JobData, dict]]:
    """Parse job text using Ollama local LLM.

    Returns list of (JobData, company_info_dict) tuples.
    """
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

    # Convert each item through the extraction schema → (JobData, company_info)
    return [extraction_to_jobdata(item, raw_text) for item in items]


def parse_job_text(raw_text: str) -> list[tuple[JobData, dict]]:
    """
    Main entry point: try Ollama first, fall back to regex parser.

    Returns list of (JobData, company_info_dict) tuples.
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
