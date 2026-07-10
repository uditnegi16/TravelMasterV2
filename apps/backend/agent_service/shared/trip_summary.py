"""
Shared helper for building a compact trip summary to hand to an LLM,
instead of dumping the full previous_trip object (parsed_trip + full
itinerary + multi_itineraries, which can easily be 5-10k+ tokens once
a trip has several hotels/flights attached).

Used by composer_node (final response) and chat_service.classify_message
(intent routing) - both only need destination/budget/dates/travelers/
summary to do their job, not the entire trip payload.
"""


def _truncate(text: str, limit: int = 220) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "..."


def previous_trip_highlights(previous_trip, summary_limit: int = 400) -> dict:
    if not previous_trip:
        return {}
    previous_parsed = previous_trip.get("parsed_trip") or {}
    return {
        "previous_summary": _truncate(previous_trip.get("summary", ""), summary_limit),
        "destination": previous_parsed.get("destination"),
        "budget": previous_parsed.get("budget"),
        "travelers": previous_parsed.get("travelers"),
        "start_date": previous_parsed.get("start_date"),
        "end_date": previous_parsed.get("end_date"),
        "flight_strategy": previous_parsed.get("flight_strategy"),
    }