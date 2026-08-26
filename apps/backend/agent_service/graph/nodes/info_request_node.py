"""
INFO_REQUEST: a follow-up question that needs real, fresh data the
existing itinerary doesn't already have (e.g. "where else can I
visit", "any other hotels nearby") -- but is NOT a request to modify
the trip, and doesn't need the full flight+hotel+places+weather
pipeline re-run.

Added 2026-08-19 after a real user report: "asked where I can visit,
only got hotels" and "said there are many hotels but didn't give a
list" traced to two compounding root causes -- composer_node.py never
saw the user's actual question (fixed separately), and FOLLOW_UP
questions (itinerary_qa_node) have zero real search capability at
all, only the LLM's general knowledge plus whatever's already in the
existing trip data. Routing these to MODIFY_TRIP was considered and
rejected: MODIFY_TRIP means "change my existing plan," a different
thing, and running the full 4-tool pipeline for a single follow-up
question burns real API calls and LLM tokens disproportionate to the
actual ask. This node calls exactly ONE real tool -- whichever the
question is actually about -- keeping cost proportional.
"""

from services.hotel_service import search_hotels
from services.places_service import search_places
from services.shown_items import filter_already_shown, remember_shown
from graph.progress_utils import emit_progress, emit_token
from llm.llm_client import get_primary_llm, get_fallback_llm
from llm.prompts import INFO_REQUEST_SYSTEM_PROMPT
from shared.logging_config import logger

# Deliberately a cheap keyword heuristic, not another LLM call --
# classify_message() already spent one real LLM call routing this
# turn to INFO_REQUEST in the first place; a second LLM call just to
# decide "places or hotels" would double the token cost for a node
# whose whole point is being cheap.
_HOTEL_KEYWORDS = ("hotel", "stay", "accommodation", "place to stay", "lodging", "near")
_PLACES_KEYWORDS = ("visit", "see", "do", "attraction", "place to go", "sightseeing", "explore")


def _pick_category(query: str) -> str:
    lowered = query.lower()
    hotel_hit = any(kw in lowered for kw in _HOTEL_KEYWORDS)
    places_hit = any(kw in lowered for kw in _PLACES_KEYWORDS)

    # Both/neither match ("what else is around") -- default to places,
    # the more common real ask behind an ambiguous follow-up.
    if hotel_hit and not places_hit:
        return "hotels"
    return "places"


def info_request_node(state: dict) -> str:
    query = state["user_query"]
    previous_trip = state.get("previous_trip") or {}
    parsed_trip = previous_trip.get("parsed_trip") or {}
    city = parsed_trip.get("destination_city")

    emit_progress(state, "info_request", "started", "Looking that up...")

    category = _pick_category(query)
    results: list[dict] = []

    session_id = state.get("session_id")
    exhausted = False

    if city:
        try:
            if category == "hotels":
                results = search_hotels(city)
            else:
                results = search_places(city)
        except Exception as e:
            logger.warning(f"info_request {category} search failed | {e}")
            results = []

        # The search is deterministic, so asking "where else can I
        # visit" twice returned the identical five. Drop anything
        # this session has already been shown.
        if results:
            fresh = filter_already_shown(session_id, category, results)
            if fresh:
                results = fresh
            else:
                exhausted = True

    shown = results[:5]
    if shown and not exhausted:
        remember_shown(session_id, category, shown)

    exhausted_note = (
        "NOTE: everything we have for this city has already been"
        " suggested earlier in this conversation. Say plainly that"
        " you have run out of new suggestions instead of repeating"
        " the earlier ones."
        if exhausted
        else ""
    )

    human_prompt = f"""
Destination: {city or "unknown -- no prior trip on record"}
Category requested: {category}
{exhausted_note}
Real search results ({len(shown)} found):
{shown}

User's Question:
{query}
"""

    emit_progress(state, "info_request", "completed")

    chunks = []
    try:
        llm = get_primary_llm(streaming=True, timeout=20)
        for chunk in llm.stream([("system", INFO_REQUEST_SYSTEM_PROMPT), ("human", human_prompt)]):
            text = chunk.content or ""
            if text:
                chunks.append(text)
                emit_token(state, text)
    except Exception as e:
        logger.warning(f"Groq unavailable for info_request | {e}")
        try:
            llm = get_fallback_llm(streaming=True, timeout=20)
            for chunk in llm.stream([("system", INFO_REQUEST_SYSTEM_PROMPT), ("human", human_prompt)]):
                text = chunk.content or ""
                if text:
                    chunks.append(text)
                    emit_token(state, text)
        except Exception as fallback_exc:
            logger.error(f"info_request unavailable on both Groq and NVIDIA | {fallback_exc}")
            return (
                "Sorry, I can't reach the AI provider right now. Please try asking again in a moment."
            )

    if not results and city:
        # Real, honest fallback -- don't let the LLM improvise details
        # about hotels/places it never actually found.
        return "".join(chunks).strip() or (
            f"I couldn't find real {category} data for {city} right now. Please try again shortly."
        )

    return "".join(chunks).strip()
