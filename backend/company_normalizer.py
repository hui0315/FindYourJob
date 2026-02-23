"""
Company name normalization — 3-layer pipeline.

Layer 1: String preprocessing (suffix removal, full/half-width normalization)
Layer 2: rapidfuzz fuzzy matching against known canonical names
Layer 3: sentence-transformers embedding cosine similarity

Each layer returns a confidence score. Results below threshold are marked
as needs_review. If all layers fail, the name becomes a new canonical entry.
"""

import re
import logging
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ── Optional heavy dependencies ──────────────────────────

try:
    from rapidfuzz import fuzz, process as rf_process
    HAS_RAPIDFUZZ = True
except ImportError:
    HAS_RAPIDFUZZ = False
    logger.info("rapidfuzz not installed — Layer 2 (fuzzy matching) disabled")

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    HAS_EMBEDDINGS = True
except ImportError:
    HAS_EMBEDDINGS = False
    logger.info("sentence-transformers not installed — Layer 3 (embedding search) disabled")


# ── Result dataclass ─────────────────────────────────────

@dataclass
class NormalizationResult:
    """Result of the company name normalization pipeline."""
    canonical_name: str          # The matched or newly created canonical name
    company_id: Optional[int]    # DB id if matched, None if new
    confidence: float            # 0.0–1.0
    method: str                  # "exact", "fuzzy", "embedding", "new"
    needs_review: bool           # True if confidence is below auto-merge threshold
    original_input: str          # The raw input before any processing
    preprocessed: str            # After Layer 1 preprocessing
    candidates: list = field(default_factory=list)  # Top candidates for review


# ── Configuration ────────────────────────────────────────

# Layer 2 thresholds (rapidfuzz score 0–100)
FUZZY_AUTO_THRESHOLD = 90       # >= this: auto-merge without review
FUZZY_REVIEW_THRESHOLD = 75     # >= this but < auto: needs_review=True
# Below FUZZY_REVIEW_THRESHOLD: no match from fuzzy layer

# Layer 3 thresholds (cosine similarity 0.0–1.0)
EMBEDDING_AUTO_THRESHOLD = 0.92
EMBEDDING_REVIEW_THRESHOLD = 0.80

# Embedding model (multilingual, small footprint ~120MB)
EMBEDDING_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

# Singleton holder for the embedding model (lazy loaded)
_embedding_model = None
_embedding_cache: dict[str, "np.ndarray"] = {}


# ── Layer 1: String Preprocessing ────────────────────────

# Suffixes to strip, ordered longest-first to avoid partial matches
_SUFFIXES_ZH = [
    "股份有限公司", "有限公司", "有限責任公司",
    "集團有限公司", "集團", "控股",
    "國際有限公司", "國際",
]

_SUFFIXES_EN = [
    "Corporation", "Incorporated", "International",
    "Company", "Limited", "Holdings",
    "Corp.", "Corp", "Inc.", "Inc",
    "Ltd.", "Ltd", "Co.", "Co",
    "LLC", "L.L.C.", "PLC", "P.L.C.",
    "GmbH", "S.A.", "B.V.", "N.V.",
    "Pvt.", "Pvt",
]

# Parenthetical notes to remove: (台灣), (Taiwan), (TW) etc.
_PAREN_PATTERN = re.compile(r"\s*[\(（].*?[\)）]")

# Multiple whitespace
_MULTI_SPACE = re.compile(r"\s+")


def _normalize_width(text: str) -> str:
    """Convert full-width characters to half-width (Ａ→A, ０→0, etc.)."""
    result = []
    for ch in text:
        code = ord(ch)
        # Full-width ASCII variants: U+FF01 (！) to U+FF5E (～)
        if 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        # Full-width space U+3000 → regular space
        elif code == 0x3000:
            result.append(" ")
        else:
            result.append(ch)
    return "".join(result)


def _strip_suffixes(text: str) -> str:
    """Remove known corporate suffixes from the end of the string."""
    stripped = text.rstrip()

    # Try Chinese suffixes first (they appear at the end)
    for suffix in _SUFFIXES_ZH:
        if stripped.endswith(suffix):
            stripped = stripped[: -len(suffix)].rstrip()
            break

    # Try English suffixes (case-insensitive)
    for suffix in _SUFFIXES_EN:
        if stripped.lower().endswith(suffix.lower()):
            stripped = stripped[: -len(suffix)].rstrip(" ,.")
            break

    return stripped


def preprocess(name: str) -> str:
    """Layer 1: Normalize a company name string for comparison.

    Steps:
    1. Strip leading/trailing whitespace
    2. Normalize full-width → half-width
    3. Remove parenthetical notes like (台灣), (Taiwan)
    4. Remove common corporate suffixes
    5. Collapse multiple spaces
    6. Apply Unicode NFC normalization
    """
    if not name:
        return name

    text = name.strip()
    text = _normalize_width(text)
    text = _PAREN_PATTERN.sub("", text)
    text = _strip_suffixes(text)
    text = _MULTI_SPACE.sub(" ", text).strip()
    text = unicodedata.normalize("NFC", text)
    return text


# ── Layer 2: rapidfuzz Fuzzy Matching ────────────────────

def _fuzzy_match(
    preprocessed: str,
    candidates: dict[str, tuple[int, str]],
) -> Optional[tuple[str, int, float]]:
    """Try fuzzy matching against known company names.

    Args:
        preprocessed: Preprocessed input name
        candidates: {preprocessed_canonical: (company_id, raw_canonical_name)}

    Returns:
        (raw_canonical_name, company_id, score_0_to_1) or None
    """
    if not HAS_RAPIDFUZZ or not candidates:
        return None

    # Use token_sort_ratio for order-insensitive matching
    # e.g., "台灣積體電路製造" vs "積體電路製造 台灣" → high score
    result = rf_process.extractOne(
        preprocessed,
        candidates.keys(),
        scorer=fuzz.token_sort_ratio,
        score_cutoff=FUZZY_REVIEW_THRESHOLD,
    )

    if result is None:
        return None

    matched_key, score, _idx = result
    company_id, raw_name = candidates[matched_key]
    return raw_name, company_id, score / 100.0  # Normalize to 0.0–1.0


def _fuzzy_top_n(
    preprocessed: str,
    candidates: dict[str, tuple[int, str]],
    n: int = 3,
) -> list[tuple[str, int, float]]:
    """Return top-N fuzzy matches for review UI."""
    if not HAS_RAPIDFUZZ or not candidates:
        return []

    results = rf_process.extract(
        preprocessed,
        candidates.keys(),
        scorer=fuzz.token_sort_ratio,
        limit=n,
        score_cutoff=FUZZY_REVIEW_THRESHOLD * 0.8,  # slightly lower for candidates list
    )

    return [
        (candidates[key][1], candidates[key][0], score / 100.0)
        for key, score, _idx in results
    ]


# ── Layer 3: Embedding-based Semantic Matching ───────────

def _get_embedding_model():
    """Lazy-load the sentence-transformer model."""
    global _embedding_model
    if _embedding_model is None and HAS_EMBEDDINGS:
        logger.info("Loading embedding model: %s", EMBEDDING_MODEL_NAME)
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        logger.info("Embedding model loaded")
    return _embedding_model


def _embed(text: str) -> Optional["np.ndarray"]:
    """Get embedding for a text string (cached)."""
    if not HAS_EMBEDDINGS:
        return None
    if text in _embedding_cache:
        return _embedding_cache[text]

    model = _get_embedding_model()
    if model is None:
        return None

    vec = model.encode(text, normalize_embeddings=True)
    _embedding_cache[text] = vec
    return vec


def _embedding_match(
    preprocessed: str,
    candidates: dict[str, tuple[int, str]],
) -> Optional[tuple[str, int, float]]:
    """Try embedding-based semantic matching.

    Returns:
        (raw_canonical_name, company_id, cosine_similarity) or None
    """
    if not HAS_EMBEDDINGS or not candidates:
        return None

    query_vec = _embed(preprocessed)
    if query_vec is None:
        return None

    best_score = -1.0
    best_match = None

    for canonical_preprocessed, (company_id, raw_name) in candidates.items():
        cand_vec = _embed(canonical_preprocessed)
        if cand_vec is None:
            continue
        # Cosine similarity (vectors are already normalized)
        score = float(np.dot(query_vec, cand_vec))
        if score > best_score:
            best_score = score
            best_match = (raw_name, company_id, score)

    if best_match and best_score >= EMBEDDING_REVIEW_THRESHOLD:
        return best_match
    return None


def invalidate_embedding_cache(name: Optional[str] = None):
    """Clear embedding cache. Call when companies are renamed/deleted."""
    if name:
        preprocessed = preprocess(name)
        _embedding_cache.pop(preprocessed, None)
    else:
        _embedding_cache.clear()


# ── Pipeline ─────────────────────────────────────────────

def normalize(
    raw_name: str,
    conn,
) -> NormalizationResult:
    """Run the 3-layer normalization pipeline.

    Args:
        raw_name: Company name as extracted from job posting
        conn: SQLite connection (to load canonical names)

    Returns:
        NormalizationResult with matched/new company info
    """
    preprocessed = preprocess(raw_name)

    # Load all canonical company names from DB
    rows = conn.execute("SELECT id, name FROM companies").fetchall()
    # Build lookup: {preprocessed_name: (id, raw_name)}
    canonical_map: dict[str, tuple[int, str]] = {}
    for row in rows:
        canon_pre = preprocess(row["name"])
        canonical_map[canon_pre] = (row["id"], row["name"])

    # ── Exact match (on preprocessed names) ──────────────
    if preprocessed in canonical_map:
        company_id, raw_canonical = canonical_map[preprocessed]
        return NormalizationResult(
            canonical_name=raw_canonical,
            company_id=company_id,
            confidence=1.0,
            method="exact",
            needs_review=False,
            original_input=raw_name,
            preprocessed=preprocessed,
        )

    # ── Layer 2: Fuzzy matching ──────────────────────────
    fuzzy_result = _fuzzy_match(preprocessed, canonical_map)
    if fuzzy_result:
        matched_name, company_id, score = fuzzy_result
        auto_merge = score >= (FUZZY_AUTO_THRESHOLD / 100.0)
        top_candidates = _fuzzy_top_n(preprocessed, canonical_map)
        return NormalizationResult(
            canonical_name=matched_name,
            company_id=company_id,
            confidence=score,
            method="fuzzy",
            needs_review=not auto_merge,
            original_input=raw_name,
            preprocessed=preprocessed,
            candidates=[
                {"name": n, "company_id": cid, "score": round(s, 3)}
                for n, cid, s in top_candidates
            ],
        )

    # ── Layer 3: Embedding search ────────────────────────
    embed_result = _embedding_match(preprocessed, canonical_map)
    if embed_result:
        matched_name, company_id, score = embed_result
        auto_merge = score >= EMBEDDING_AUTO_THRESHOLD
        return NormalizationResult(
            canonical_name=matched_name,
            company_id=company_id,
            confidence=score,
            method="embedding",
            needs_review=not auto_merge,
            original_input=raw_name,
            preprocessed=preprocessed,
        )

    # ── No match: new company ────────────────────────────
    return NormalizationResult(
        canonical_name=raw_name.strip(),  # Use original (non-stripped) as canonical
        company_id=None,
        confidence=0.0,
        method="new",
        needs_review=False,
        original_input=raw_name,
        preprocessed=preprocessed,
    )
