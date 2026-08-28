import json

from llm.llm_client import get_primary_llm, get_fallback_llm
from shared.logging_config import logger
from services.currency_format import normalise_currency
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
    summary = {
        key: recommended_itinerary.get(key)
        for key in (
            "total_flight_cost", "total_hotel_cost", "layover_cost",
            "total_trip_cost", "remaining_budget", "within_budget",
        )
        if key in recommended_itinerary
    }

    # 2026-08-19: a real user test caught a narrative/trip-card
    # mismatch -- the composer's text named one hotel, but the price
    # it quoted belonged to a DIFFERENT hotel actually shown on the
    # trip card. Root cause: the prompt was showing the LLM two
    # separate, independently-sourced hotel references -- the raw,
    # unranked state["hotels"][:1] (just whichever came back first
    # from search) under "Hotels", and this cost summary (correct,
    # but previously name-less) under "Recommended Itinerary Cost
    # Summary". The LLM had no way to know they could disagree.
    # Fixed by surfacing the ACTUAL hotel this itinerary's cost was
    # computed from (recommended_itinerary["hotels"][0], set in
    # trip_optimizer.py::build_itinerary from the exact same hotels
    # list used for total_hotel_cost) as part of this single, correct
    # source, rather than leaving the composer to reconcile two
    # sources that were never guaranteed to agree.
    itinerary_hotels = recommended_itinerary.get("hotels") or []
    if itinerary_hotels:
        summary["hotel_name"] = itinerary_hotels[0].get("name")

    return summary
    
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

{conversation_type}

User's Actual Question/Request (this turn)

{state.get("user_query", "")}

Previous Trip Highlights (only what's relevant to this turn, not the full trip)

{json.dumps(previous_context, indent=2)}

Recent Conversation (last {len(recent_history)} turns, truncated)

{json.dumps(recent_history, indent=2)}
You are an expert AI Travel Planner.

Write ONLY a short natural language summary.

Rules:
- Read the User's Actual Question/Request above FIRST. If it's
  primarily about one specific thing (places to visit, hotels,
  weather, flights), LEAD with that, not with a generic budget/hotel
  summary. A question about places to visit should get an answer
  about places to visit, not a recap of the hotel and flight.
- If Conversation Type is MODIFY_TRIP:
  Respond as an updated version of the previous itinerary.
  Mention only what changed.
  When you describe an earlier part of the trip as unchanged, it
  must match what was actually in the previous itinerary. Do not
  add new places, activities or day-trips to days you are calling
  unchanged -- saying "days 1-5 are the same" and then listing
  stops that were never there is worse than not mentioning those
  days at all.

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
- Use the Travel Knowledge section to explain why the destination suits the traveler, and mention destination highlights naturally -- but only attractions/food that match the traveler's preferences.
- Use live Flights, Hotels, Places, and Weather information whenever available; if live information conflicts with Travel Knowledge, trust the live information.
- If you mention a specific price or cost figure, it must be paired with the hotel named in "Recommended Itinerary Cost Summary"'s hotel_name field -- that's the hotel the price was actually computed from. The "Hotels" section below may list a different hotel; use it only for descriptive detail (amenities, rating), never pair its name with a price from the cost summary.
- If flight, hotel, or any other section's data is unavailable, continue naturally without mentioning the gap.
- If Errors contains messages, explain the limitation naturally instead of pretending information exists.
- Never invent facts.
- Currency: every money figure given to you is already in Indian
  Rupees. Write them as "₹27,492" -- the symbol only. Never write
  a different currency symbol, and never append a currency code
  ("₹27,492 INR" and "¥8,500" are both wrong). If a source
  currency is mentioned in the data, it has already been
  converted; report the rupee figure.
- Keep the response conversational and under 200 words.
- Do NOT output JSON, use Markdown, or use headings.
- Do NOT repeat the user's request verbatim.

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
            # The prompt tells the model every figure is already INR,
            # but a prompt is a tendency, not a guarantee -- live
            # output included "¥8,500" for a rupee amount. Normalise
            # deterministically rather than trusting it.
            state["final_response"] = normalise_currency(
                "".join(chunks).strip()
            )
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