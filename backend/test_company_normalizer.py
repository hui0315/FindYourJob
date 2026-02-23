"""Tests for company_normalizer.py — 3-layer normalization pipeline."""

import sqlite3
import pytest
from company_normalizer import (
    preprocess,
    normalize,
    NormalizationResult,
    FUZZY_AUTO_THRESHOLD,
    FUZZY_REVIEW_THRESHOLD,
    HAS_RAPIDFUZZ,
    HAS_EMBEDDINGS,
)


# ── Test fixtures ────────────────────────────────────────

@pytest.fixture
def db():
    """In-memory SQLite with companies table and some seed data."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    """)
    seed = [
        "台灣積體電路製造",
        "Google",
        "聯發科技",
        "鴻海精密工業",
        "中華電信",
        "台達電子工業",
        "Microsoft Corporation",
        "Amazon Web Services",
    ]
    for name in seed:
        conn.execute("INSERT INTO companies (name) VALUES (?)", (name,))
    conn.commit()
    return conn


# ── Layer 1: Preprocessing tests ─────────────────────────

class TestPreprocess:
    def test_strip_whitespace(self):
        assert preprocess("  Google  ") == "Google"

    def test_remove_zh_suffix_gufen(self):
        assert preprocess("台積電股份有限公司") == "台積電"

    def test_remove_zh_suffix_youxian(self):
        assert preprocess("聯發科技有限公司") == "聯發科技"

    def test_remove_en_suffix_inc(self):
        assert preprocess("Google Inc.") == "Google"

    def test_remove_en_suffix_corporation(self):
        assert preprocess("Microsoft Corporation") == "Microsoft"

    def test_remove_en_suffix_ltd(self):
        assert preprocess("Foxconn Ltd.") == "Foxconn"

    def test_remove_en_suffix_llc(self):
        assert preprocess("Acme LLC") == "Acme"

    def test_fullwidth_to_halfwidth(self):
        # Ｇｏｏｇｌｅ → Google
        assert preprocess("Ｇｏｏｇｌｅ") == "Google"

    def test_fullwidth_numbers(self):
        assert preprocess("１２３") == "123"

    def test_fullwidth_space(self):
        # U+3000 (ideographic space) → regular space
        assert preprocess("台灣\u3000積體電路") == "台灣 積體電路"

    def test_remove_parenthetical_zh(self):
        assert preprocess("Google（台灣）") == "Google"

    def test_remove_parenthetical_en(self):
        assert preprocess("Google (Taiwan)") == "Google"

    def test_combined_transformations(self):
        # Full-width + suffix + parenthetical
        assert preprocess("Ｍｉｃｒｏｓｏｆｔ　Ｃｏｒｐｏｒａｔｉｏｎ（台灣）") == "Microsoft"

    def test_empty_string(self):
        assert preprocess("") == ""

    def test_unicode_normalization(self):
        # NFC normalization — combining characters should be composed
        import unicodedata
        # é as e + combining acute
        decomposed = "Caf\u0065\u0301"
        result = preprocess(decomposed)
        assert result == unicodedata.normalize("NFC", decomposed)

    def test_multiple_spaces_collapsed(self):
        assert preprocess("Taiwan   Semiconductor   Manufacturing") == "Taiwan Semiconductor Manufacturing"

    def test_no_suffix_no_change(self):
        assert preprocess("台積電") == "台積電"

    def test_jituan_suffix(self):
        assert preprocess("鴻海集團") == "鴻海"

    def test_konggu_suffix(self):
        assert preprocess("長江控股") == "長江"


# ── Layer 2: Fuzzy matching tests ────────────────────────

@pytest.mark.skipif(not HAS_RAPIDFUZZ, reason="rapidfuzz not installed")
class TestFuzzyMatching:
    def test_exact_preprocessed_match(self, db):
        """Exact match after preprocessing should give confidence=1.0."""
        result = normalize("台灣積體電路製造", db)
        assert result.method == "exact"
        assert result.confidence == 1.0
        assert result.company_id is not None
        assert result.needs_review is False

    def test_exact_match_with_suffix_stripped(self, db):
        """'台灣積體電路製造股份有限公司' preprocesses to '台灣積體電路製造' → exact match."""
        result = normalize("台灣積體電路製造股份有限公司", db)
        assert result.method == "exact"
        assert result.confidence == 1.0
        assert result.canonical_name == "台灣積體電路製造"

    def test_exact_match_with_suffix_en(self, db):
        """'Microsoft Corporation' preprocesses to 'Microsoft' → matches 'Microsoft Corporation'."""
        result = normalize("Microsoft Corp.", db)
        # Both preprocess to "Microsoft", so exact match
        assert result.method == "exact"
        assert result.confidence == 1.0

    def test_fuzzy_match_slight_variation(self, db):
        """Minor variation should trigger fuzzy match with high confidence."""
        result = normalize("台灣積體電路", db)
        # This is a substring, fuzzy should pick it up
        assert result.company_id is not None
        assert result.method in ("exact", "fuzzy")
        assert result.confidence >= FUZZY_REVIEW_THRESHOLD / 100.0

    def test_no_match_completely_different(self, db):
        """Totally unrelated name should result in method='new'."""
        result = normalize("完全不存在的公司", db)
        assert result.company_id is None
        assert result.method == "new"
        assert result.confidence == 0.0
        assert result.needs_review is False

    def test_original_input_preserved(self, db):
        result = normalize("  Google Inc.  ", db)
        assert result.original_input == "  Google Inc.  "
        assert result.preprocessed == "Google"

    def test_google_fullwidth(self, db):
        """Full-width 'Ｇｏｏｇｌｅ' should match 'Google'."""
        result = normalize("Ｇｏｏｇｌｅ", db)
        assert result.company_id is not None
        assert result.canonical_name == "Google"
        assert result.method == "exact"

    def test_candidates_returned_for_review(self, db):
        """When needs_review=True, candidates list should be non-empty."""
        # Use a name that's somewhat similar to trigger fuzzy but not exact
        result = normalize("聯發科", db)
        # "聯發科" vs "聯發科技" — should be fuzzy match
        if result.method == "fuzzy" and result.needs_review:
            assert len(result.candidates) > 0


# ── Pipeline integration tests ───────────────────────────

class TestPipeline:
    def test_new_company_on_empty_db(self):
        """With no companies in DB, everything is 'new'."""
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.execute("CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT)")
        conn.commit()

        result = normalize("台積電", conn)
        assert result.method == "new"
        assert result.company_id is None
        assert result.confidence == 0.0

    def test_result_dataclass_fields(self, db):
        result = normalize("Google", db)
        assert isinstance(result, NormalizationResult)
        assert hasattr(result, "canonical_name")
        assert hasattr(result, "company_id")
        assert hasattr(result, "confidence")
        assert hasattr(result, "method")
        assert hasattr(result, "needs_review")
        assert hasattr(result, "original_input")
        assert hasattr(result, "preprocessed")
        assert hasattr(result, "candidates")

    def test_confidence_range(self, db):
        """Confidence should always be 0.0–1.0."""
        for name in ["Google", "台積電", "不存在的公司XYZ", "Microsoft Corporation"]:
            result = normalize(name, db)
            assert 0.0 <= result.confidence <= 1.0

    def test_method_values(self, db):
        """Method should be one of the defined values."""
        valid_methods = {"exact", "fuzzy", "embedding", "new"}
        for name in ["Google", "完全不存在"]:
            result = normalize(name, db)
            assert result.method in valid_methods
