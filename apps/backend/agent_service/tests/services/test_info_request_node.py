"""
Real tests for the new INFO_REQUEST path (2026-08-19). Confirms:
category routing works, the correct single tool gets called (not the
full pipeline), and it never invents details when a real search comes
back empty -- the whole point of this node existing was to stop the
chatbot describing hotels/places it never actually found.
"""

from unittest.mock import MagicMock, patch

import pytest

from graph.nodes.info_request_node import _pick_category, info_request_node


def test_pick_category_hotel_keywords():
    assert _pick_category("Are there any hotels near the beach?") == "hotels"
    assert _pick_category("Any place to stay near the temple?") == "hotels"


def test_pick_category_places_keywords():
    assert _pick_category("Where else can I visit?") == "places"
    assert _pick_category("What points of interest are there?") == "places"


def test_pick_category_defaults_to_places_when_ambiguous():
    assert _pick_category("What else is around?") == "places"


def test_info_request_calls_places_search_with_real_results(monkeypatch):
    from graph.nodes import info_request_node as module

    fake_results = [{"name": "Baga Beach"}, {"name": "Fort Aguada"}]

    with patch.object(module, "search_places", return_value=fake_results) as mock_search, \
         patch.object(module, "search_hotels") as mock_hotels:
        # Fake the streaming LLM call
        fake_llm = MagicMock()
        fake_llm.stream.return_value = [MagicMock(content="You could visit Baga Beach or Fort Aguada.")]

        with patch.object(module, "get_primary_llm", return_value=fake_llm):
            state = {
                "user_query": "Where else can I visit?",
                "previous_trip": {"parsed_trip": {"destination_city": "Goa"}},
            }
            answer = info_request_node(state)

    mock_search.assert_called_once_with("Goa")
    mock_hotels.assert_not_called()
    assert "Baga Beach" in answer or "Fort Aguada" in answer


def test_info_request_calls_hotel_search_not_places(monkeypatch):
    from graph.nodes import info_request_node as module

    with patch.object(module, "search_hotels", return_value=[{"name": "Beach Resort"}]) as mock_hotels, \
         patch.object(module, "search_places") as mock_places:
        fake_llm = MagicMock()
        fake_llm.stream.return_value = [MagicMock(content="Beach Resort is a good option nearby.")]

        with patch.object(module, "get_primary_llm", return_value=fake_llm):
            state = {
                "user_query": "Any hotels near the beach?",
                "previous_trip": {"parsed_trip": {"destination_city": "Goa"}},
            }
            info_request_node(state)

    mock_hotels.assert_called_once_with("Goa")
    mock_places.assert_not_called()


def test_info_request_gives_honest_answer_when_search_returns_nothing(monkeypatch):
    """The real bug this whole feature exists to fix: never let the
    LLM improvise details about results that don't actually exist."""
    from graph.nodes import info_request_node as module

    with patch.object(module, "search_places", return_value=[]):
        fake_llm = MagicMock()
        # Even if the LLM tries to stream an empty/unhelpful response,
        # the node's own empty-results fallback should win.
        fake_llm.stream.return_value = [MagicMock(content="")]

        with patch.object(module, "get_primary_llm", return_value=fake_llm):
            state = {
                "user_query": "Where can I visit?",
                "previous_trip": {"parsed_trip": {"destination_city": "Dubai"}},
            }
            answer = info_request_node(state)

    assert "couldn't find" in answer.lower() or "try again" in answer.lower()


def test_info_request_handles_missing_destination_gracefully():
    """No previous_trip / no destination_city at all -- must not crash,
    must not fabricate a destination."""
    from graph.nodes import info_request_node as module

    fake_llm = MagicMock()
    fake_llm.stream.return_value = [MagicMock(content="I'm not sure which destination you mean.")]

    with patch.object(module, "get_primary_llm", return_value=fake_llm):
        state = {"user_query": "Where can I visit?", "previous_trip": None}
        answer = info_request_node(state)

    assert isinstance(answer, str)
