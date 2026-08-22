"""
Regression tests for the 2026-08-22 production bug: "plan a trip in
April" produced departure_date="April", which Duffel answered with 422
Unprocessable Entity. The flight tool caught it and the UI showed "No
flight available" with no hint that the date was the problem.

Design decision: an ambiguous or past date is NOT guessed at. Resolving
"April" to next April would silently plan a trip for a year the user
never said. These return "" so the graph stops and asks instead.
"""

from datetime import datetime, timedelta

import pytest

from graph.nodes.location_resolver_node import (
    location_resolver_node,
    normalize_date,
)


def _future(days=90):
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


@pytest.mark.parametrize("raw", ["April", "in April", "april", "Apr"])
def test_month_without_a_year_is_not_guessed(raw):
    """The original bug. A bare month must not reach the flight API."""
    assert normalize_date(raw) == ""


def test_day_and_month_without_a_year_is_not_guessed():
    """
    "April 10" is equally ambiguous -- the old code stamped the current
    year, producing a date already months past when asked in August.
    """
    past = datetime.now() - timedelta(days=60)
    assert normalize_date(past.strftime("%B %d")) == ""


def test_an_unambiguous_future_date_this_year_is_accepted():
    future = datetime.now() + timedelta(days=60)
    out = normalize_date(future.strftime("%B %d"))
    assert out == future.strftime("%Y-%m-%d")


def test_iso_future_date_passes_through():
    value = _future()
    assert normalize_date(value) == value


def test_iso_past_date_is_rejected():
    past = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
    assert normalize_date(past) == ""


def test_unparseable_returns_empty_not_a_bogus_string():
    for raw in ["next month", "sometime soon", "asap"]:
        assert normalize_date(raw) == ""


def test_empty_input_stays_empty():
    assert normalize_date("") == ""


def _resolve(start_date):
    state = {
        "parsed_trip": {
            "origin": "Delhi",
            "destination": "Japan",
            "start_date": start_date,
        },
        "progress_callback": None,
    }
    return location_resolver_node(state)["parsed_trip"]


def test_ambiguous_date_flags_for_clarification():
    assert _resolve("April")["needs_date_clarification"] is True


def test_missing_date_flags_for_clarification():
    assert _resolve("")["needs_date_clarification"] is True


def test_a_good_date_does_not_flag():
    trip = _resolve(_future())
    assert trip["needs_date_clarification"] is False
    # and the rest of resolution still works
    assert trip["destination_city"] == "Tokyo"
    assert trip["destination"] == "NRT"


def test_graph_routes_to_end_when_the_date_is_ambiguous():
    from graph.build_graph import (
        DATE_CLARIFICATION_MESSAGE,
        _needs_date_clarification,
    )

    state = {"parsed_trip": {"needs_date_clarification": True}}
    assert _needs_date_clarification(state) == "ask_for_date"
    assert state["final_response"] == DATE_CLARIFICATION_MESSAGE

    ok = {"parsed_trip": {"needs_date_clarification": False}}
    assert _needs_date_clarification(ok) == "continue"
