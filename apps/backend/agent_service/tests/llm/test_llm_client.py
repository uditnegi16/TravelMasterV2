"""
Real load testing (2026-08-04, Issue 12) confirmed a genuine root
cause of Groq TPM rate-limit collisions: planner_node and
composer_node both drew from the same GROQ_API_KEY, so a single
trip-planning request's two heaviest calls competed for the same
12000-tokens-per-minute budget every time -- not just under
concurrent load, even sequentially. get_classifier_llm() already had
a proven separate-key pattern for exactly this kind of problem;
get_planner_llm() extends it. These tests confirm both states.
"""

from llm.llm_client import get_planner_llm, get_classifier_llm, get_primary_llm


def test_planner_llm_falls_back_to_shared_key_when_unset(monkeypatch):
    monkeypatch.delenv("GROQ_PLANNER_API_KEY", raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "shared-key-123")

    llm = get_planner_llm()

    assert llm.groq_api_key.get_secret_value() == "shared-key-123"


def test_planner_llm_uses_dedicated_key_when_set(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "shared-key-123")
    monkeypatch.setenv("GROQ_PLANNER_API_KEY", "planner-only-key-456")

    llm = get_planner_llm()

    assert llm.groq_api_key.get_secret_value() == "planner-only-key-456"


def test_planner_and_composer_use_different_keys_when_both_configured(monkeypatch):
    """
    The actual fix, end to end: with both dedicated keys set, a single
    NEW_TRIP request's planner call and composer call now draw from
    genuinely separate Groq accounts/budgets, not the same one.
    """
    monkeypatch.setenv("GROQ_API_KEY", "composer-key-shared")
    monkeypatch.setenv("GROQ_PLANNER_API_KEY", "planner-only-key")

    planner_llm = get_planner_llm()
    composer_llm = get_primary_llm()  # what composer_node.py actually calls

    assert planner_llm.groq_api_key.get_secret_value() == "planner-only-key"
    assert composer_llm.groq_api_key.get_secret_value() == "composer-key-shared"
    assert (
        planner_llm.groq_api_key.get_secret_value()
        != composer_llm.groq_api_key.get_secret_value()
    )


def test_classifier_llm_still_falls_back_correctly(monkeypatch):
    """Confirms the new function didn't disturb the existing, already-
    proven classifier separation this pattern was copied from."""
    monkeypatch.delenv("GROQ_CLASSIFIER_API_KEY", raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "shared-key-789")

    llm = get_classifier_llm()

    assert llm.groq_api_key.get_secret_value() == "shared-key-789"
