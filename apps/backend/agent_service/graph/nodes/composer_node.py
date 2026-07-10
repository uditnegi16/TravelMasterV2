import json

from llm.llm_client import get_primary_llm, get_fallback_llm
from shared.logging_config import logger
from shared.trip_summary import previous_trip_highlights, _truncate
from graph.progress_utils import emit_progress, emit_token


def _recent_history(history, max_turns=3):
    history = history or []
    trimmed = []
    for turn in history[-max_turns:]:
        trimmed.append({
            "role": turn.get("role"),
            "content": _truncate(turn.get("content", ""), 220),
        })
    return trimmed


def _itinerary_cost_summary(recommended_itinerary):
    if not recommended_itinerary:
        return {}
    return {
        key: recommended_itinerary.get(key)
        for key in (
            "total_flight_cost", "total_hotel_cost", "layover_cost",
            "total_trip_cost", "remaining_budget", "within_budget",
        )
        if key in recommended_itinerary
    }
    
def composer_node(state):
    emit_progress(
        state,
        "composer",
        "started",
        "Generating itinerary...",
    )
    conversation_type = state.get("conversation_type", "NEW_TRIP")

    previous_context = (
        previous_trip_highlights(state.get("previous_trip"))
        if conversation_type != "NEW_TRIP" else {}
    )
    recent_history = (
        _recent_history(state.get("conversation_history"))
        if conversation_type != "NEW_TRIP" else []
    )

    prompt = f"""
    Conversation Type

Conversation Type

{conversation_type}

Previous Trip Highlights (only what's relevant to this turn, not the full trip)

{json.dumps(previous_context, indent=2)}

Recent Conversation (last {len(recent_history)} turns, truncated)

{json.dumps(recent_history, indent=2)}
You are an expert AI Travel Planner.

Write ONLY a short natural language summary.

Rules:
- If Conversation Type is MODIFY_TRIP:
  Respond as an updated version of the previous itinerary.
  Mention only what changed.

- If Conversation Type is FOLLOW_UP:
  Answer the user's question using the current itinerary.
  Do not regenerate the whole trip unless necessary.

- If Conversation Type is GENERAL_CHAT:
  Reply conversationally using the current itinerary and travel knowledge.
  Do not generate a brand-new itinerary unless explicitly requested.

- If Conversation Type is NEW_TRIP:
  Generate a complete new travel recommendation.
- Write a personalized travel recommendation.
- Present the recommended itinerary naturally.
- Briefly explain WHY this itinerary was selected.
- Mention if it is Budget Saver, Best Value or Luxury.
- Mention the remaining budget naturally if available.
- Mention one tradeoff if appropriate.
- Mention destination highlights using the Travel Knowledge.
- Use Flights, Hotels, Places and Weather whenever available.
- Ignore any missing section gracefully.
- If Errors contains messages, explain the limitation naturally instead of pretending information exists.
- Never invent facts.
- Keep the response under 250 words.
- Do NOT output JSON.
- Do NOT use Markdown.
- Do NOT use headings.
- Do NOT repeat the user's request.
- Use the Travel Knowledge section to explain why the destination suits the traveler.
- Use the live Flights, Hotels, Places, and Weather information whenever available.
- If live information conflicts with Travel Knowledge, always trust the live information.
- Mention the destination's highlights naturally.
- Mention notable attractions only if they match the traveler's preferences.
- Mention local food only if relevant to the preferences.
- Mention weather naturally if available.
- If flight or hotel data is unavailable, continue without mentioning missing data.
- Keep the response conversational.
- Maximum 200 words.
- Do NOT use Markdown.
- Do NOT use headings.
- Do NOT output JSON.
- Do NOT invent facts.

Trip

{json.dumps(state["parsed_trip"], indent=2)}

Errors

{json.dumps(state.get("errors", []), indent=2)}

Travel Knowledge

{state.get("retrieved_context", "")}

Flights

{json.dumps(state.get("recommended_flight"), indent=2)}

Hotels

{json.dumps(state["hotels"][:1], indent=2)}

Places

{json.dumps(state["places"][:2], indent=2)}

Weather

{json.dumps(state["weather"], indent=2)}

Recommended Profile

{state.get("recommended_profile", "")}

Recommended Itinerary Cost Summary

{json.dumps(_itinerary_cost_summary(state.get("recommended_itinerary")), indent=2)}

Alternative Profiles

{[
    option["profile"]
    for option in state.get("multi_itineraries", [])
]}
"""

    try:
        chunks = []
        degraded = False

        try:
            llm = get_primary_llm(streaming=True, timeout=20)

            for chunk in llm.stream(prompt):
                text = chunk.content or ""

                if text:
                    chunks.append(text)
                    emit_token(state, text)

            logger.info("LLM Provider | Groq")

        except Exception as e:
            logger.warning(f"Groq unavailable | {e}")

            try:
                llm = get_fallback_llm(streaming=True, timeout=20)

                for chunk in llm.stream(prompt):
                    text = chunk.content or ""

                    if text:
                        chunks.append(text)
                        emit_token(state, text)

                logger.info("LLM Provider | NVIDIA NIM")

            except Exception as fallback_exc:
                # Both providers down (quota exhaustion, timeout, outage).
                # We already have real trip data from planner/tools by this
                # point - degrade to a templated summary instead of raising
                # and turning a fully-planned trip into a raw 500.
                logger.error(f"Composer LLM unavailable on both Groq and NVIDIA | {fallback_exc}")
                chunks = []
                degraded = True

        if chunks:
            state["final_response"] = "".join(chunks).strip()
        else:
            parsed_trip = state.get("parsed_trip") or {}
            destination = parsed_trip.get("destination") or "your destination"
            hotels = state.get("hotels") or []
            itinerary = state.get("recommended_itinerary") or {}
            profile = state.get("recommended_profile") or ""

            lines = [f"Here's what I put together for {destination}."]
            if hotels:
                hotel = hotels[0]
                name, cost = hotel.get("name"), hotel.get("estimated_total_cost")
                if name and cost is not None:
                    lines.append(f"Recommended stay: {name} (~₹{cost:,.0f} total).")
                elif name:
                    lines.append(f"Recommended stay: {name}.")
            if itinerary.get("total_trip_cost") is not None:
                lines.append(f"Estimated trip cost: ₹{itinerary['total_trip_cost']:,.0f}.")
            if itinerary.get("remaining_budget") is not None:
                lines.append(f"Remaining budget: ₹{itinerary['remaining_budget']:,.0f}.")
            if profile:
                lines.append(f"This is the {profile} option.")
            lines.append(
                "I couldn't generate a fuller writeup right now (our AI provider "
                "is temporarily unavailable) — the numbers above are accurate, "
                "feel free to ask again in a bit for the full description."
            )
            state["final_response"] = " ".join(lines)

        emit_progress(
            state,
            "composer",
            "completed_degraded" if degraded else "completed",
        )

        return state

    except Exception:
        emit_progress(
            state,
            "composer",
            "failed",
        )
        raise