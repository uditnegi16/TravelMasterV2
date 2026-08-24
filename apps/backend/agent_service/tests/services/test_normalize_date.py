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
    DATE_CLARIFICATION_MESSAGE,
    location_resolver_node,
    normalize_date,
)


def _parse(value):
    return datetime.strptime(value, "%Y-%m-%d").date()


def _future(days=90):
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


@pytest.mark.parametrize("raw", ["April", "in April", "april", "Apr"])
def test_month_without_a_year_is_not_guessed(raw):
    """The original bug. A bare month must not reach the flight API."""
    assert normalize_date(raw) == ""


def test_day_and_month_without_a_year_uses_the_next_occurrence():
    """
    A day AND month with no year is not really ambiguous -- "September
    15" means the next 15 September. Rejecting these was a regression:
    it asked users for a date they had already given.
    """
    past = datetime.now() - timedelta(days=60)
    out = _parse(normalize_date(past.strftime("%B %d")))
    assert out >= datetime.now().date()
    assert (out.month, out.day) == (past.month, past.day)


def test_a_day_and_month_still_ahead_stays_in_this_year():
    future = datetime.now() + timedelta(days=20)
    assert normalize_date(future.strftime("%B %d")) == future.strftime(
        "%Y-%m-%d"
    )


@pytest.mark.parametrize(
    "raw",
    ["sept 15", "Sept 15", "15th September", "September 15th", "15 sept"],
)
def test_common_human_spellings_parse(raw):
    """
    strptime's %b accepts "Sep" but not "Sept", and chokes on ordinal
    suffixes -- so "sept 15" and "20th September" were being rejected
    as unparseable and the user was asked for a date they had given.
    """
    assert normalize_date(raw) != ""


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


def test_router_reads_the_flag_without_writing_state():
    """
    LangGraph passes conditional-edge functions a COPY of state and
    discards their writes. Setting final_response here (as the first
    version did) silently lost the message and the reply fell back to
    the generic "Here's what I found." The router must stay pure.
    """
    from graph.build_graph import _needs_date_clarification

    state = {"parsed_trip": {"needs_date_clarification": True}}
    assert _needs_date_clarification(state) == "ask_for_date"
    assert "final_response" not in state, (
        "router wrote to state; LangGraph will discard it"
    )

    ok = {"parsed_trip": {"needs_date_clarification": False}}
    assert _needs_date_clarification(ok) == "continue"


def test_the_node_sets_the_clarification_message():
    """This is the assertion the previous test should have made: the
    message has to survive on the state the graph actually returns."""
    state = {
        "parsed_trip": {
            "origin": "Delhi",
            "destination": "Japan",
            "start_date": "April",
        },
        "final_response": "",
        "progress_callback": None,
    }
    location_resolver_node(state)
    assert state["final_response"] == DATE_CLARIFICATION_MESSAGE


def test_a_good_date_leaves_the_response_empty_for_the_composer():
    state = {
        "parsed_trip": {
            "origin": "Delhi",
            "destination": "Japan",
            "start_date": _future(),
        },
        "final_response": "",
        "progress_callback": None,
    }
    location_resolver_node(state)
    assert state["final_response"] == ""


def test_planner_prompt_does_not_instruct_the_model_to_guess_a_year():
    """
    The backend clarification could never fire because the planner prompt
    told the model to resolve a bare month into a concrete year itself,
    so start_date always arrived already valid. Guard against that
    instruction coming back.
    """
    from datetime import date

    from llm.prompts import PLANNER_SYSTEM_PROMPT

    prompt = PLANNER_SYSTEM_PROMPT.format(current_date=date.today().isoformat())

    # Day + month with no year resolves to the next occurrence; only a
    # month with no day (or a vague phrase) is sent back for clarifying.
    assert "A month with NO day" in prompt
    assert "use the NEXT occurrence" in prompt

    # The old rule told the model to pick a year, and a blanket "never
    # return an empty string" that contradicted leaving dates blank.
    assert "If that date has already passed during the current year" not in prompt
    assert "Never return an empty string" not in prompt


def test_empty_start_date_from_the_planner_reaches_the_clarification():
    """End to end: planner returns "" -> node flags -> router ends."""
    from graph.build_graph import _needs_date_clarification

    state = {
        "parsed_trip": {
            "origin": "Delhi",
            "destination": "Japan",
            "start_date": "",
        },
        "final_response": "",
        "progress_callback": None,
    }
    out = location_resolver_node(state)

    assert _needs_date_clarification(out) == "ask_for_date"
    assert state["final_response"] == DATE_CLARIFICATION_MESSAGE
