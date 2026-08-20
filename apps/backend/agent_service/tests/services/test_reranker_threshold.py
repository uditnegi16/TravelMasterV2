"""
Real test for the relevance-threshold fix (2026-08-19). Confirms the
actual reported bug's mechanism directly: with a low-similarity result
(the only real scenario when a destination has no matching real
content -- e.g. Dubai, when only Goa has real knowledge-base content),
it now gets filtered out instead of always being returned as "the
closest available" match regardless of true relevance.
"""

from retrieval.reranker import CrossEncoderReranker, MIN_RELEVANCE_SIMILARITY


def test_filters_out_low_similarity_results():
    reranker = CrossEncoderReranker()
    documents = [
        {"title": "Goa Beaches", "similarity": 0.22},  # below threshold
        {"title": "Goa Nightlife", "similarity": 0.18},  # below threshold
    ]

    results = reranker.rerank("Tell me about Dubai", documents)

    assert results == []


def test_keeps_genuinely_relevant_results():
    reranker = CrossEncoderReranker()
    documents = [
        {"title": "Goa Beaches", "similarity": 0.81},
        {"title": "Goa Nightlife", "similarity": 0.6},
    ]

    results = reranker.rerank("Tell me about Goa", documents)

    assert len(results) == 2


def test_mixed_results_only_relevant_ones_survive():
    reranker = CrossEncoderReranker()
    documents = [
        {"title": "Goa Beaches", "similarity": 0.75},
        {"title": "Unrelated chunk", "similarity": 0.1},
    ]

    results = reranker.rerank("some query", documents)

    assert len(results) == 1
    assert results[0]["title"] == "Goa Beaches"


def test_threshold_is_a_real_positive_number_not_disabled():
    # Confirms nobody accidentally sets this to 0 later, which would
    # silently re-disable the whole fix.
    assert MIN_RELEVANCE_SIMILARITY > 0


def test_empty_input_still_returns_empty():
    reranker = CrossEncoderReranker()
    assert reranker.rerank("anything", []) == []
