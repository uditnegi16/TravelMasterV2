"""
Handles MODIFY_TRIP turns.

Replaces the old approach (planner_node getting the raw user message
plus previous_trip stuffed into its system prompt, and hoping the
"never assume missing information" instruction didn't wipe fields it
should have kept). This node's only job is a targeted update, so it
can be told - unambiguously - to preserve everything except what the
user actually asked to change.
"""

from graph.state import TripPlanState
from llm.llm_client import get_primary_llm, get_fallback_llm
from llm.prompts import TRIP_MODIFIER_SYSTEM_PROMPT
from shared.schemas import TripRequest
from shared.logging_config import logger
from graph.progress_utils import emit_progress

_EMPTY = ("", None, 0, [], {})


def trip_modifier_node(state: TripPlanState) -> TripPlanState:
    emit_progress(
        state,
        "trip_modifier",
        "started",
        "Updating your trip...",
    )

    previous_trip = state.get("previous_trip") or {}
    previous_parsed = previous_trip.get("parsed_trip") or {}

    messages = [
        ("system", TRIP_MODIFIER_SYSTEM_PROMPT),
        (
            "human",
            f"""Existing trip:
{previous_parsed}

User's request:
{state["user_query"]}

Return the full updated TripRequest.""",
        ),
    ]

    updated_trip = None

    try:
        llm = get_primary_llm(streaming=False, timeout=20).with_structured_output(TripRequest)
        response = llm.invoke(messages)
        updated_trip = response.model_dump()

    except Exception as e:
        logger.warning(f"Trip modifier Groq failed, trying NVIDIA fallback | {e}")

        try:
            fallback_llm = get_fallback_llm(
                streaming=False, timeout=20
            ).with_structured_output(TripRequest)
            response = fallback_llm.invoke(messages)
            updated_trip = response.model_dump()

        except Exception as fallback_exc:
            # Both providers down. We can't safely guess what the user's
            # change should map to (unlike composer, there's no
            # already-computed data to templatize) - so the correct
            # degrade here is to leave the trip exactly as it was and
            # let the user know the change didn't apply, instead of
            # raising and turning this into a 500 that drops the whole
            # request.
            logger.error(
                f"Trip modifier unavailable on both Groq and NVIDIA | {fallback_exc}"
            )
            state["parsed_trip"] = previous_parsed
            state["flight_strategy"] = previous_parsed.get(
                "flight_strategy", "prefer_direct"
            )
            state.setdefault("errors", []).append(
                "I couldn't apply that change right now (AI provider "
                "temporarily unavailable) — your trip is unchanged. "
                "Please try the request again in a moment."
            )

            emit_progress(state, "trip_modifier", "completed_degraded")
            return state

    # Safety net: if the modifier left a field empty but the
    # previous trip had a real value there, the user didn't ask
    # to change it - keep the old value instead of losing it.
    for key, value in previous_parsed.items():
        if updated_trip.get(key) in _EMPTY and value not in _EMPTY:
            updated_trip[key] = value

    state["parsed_trip"] = updated_trip
    state["flight_strategy"] = updated_trip.get(
        "flight_strategy", "prefer_direct"
    )

    emit_progress(
        state,
        "trip_modifier",
        "completed",
    )

    return state