import json

from llm.llm_client import get_primary_llm, get_fallback_llm
from shared.logging_config import logger
from graph.progress_utils import emit_progress, emit_token
def composer_node(state):
    emit_progress(
        state,
        "composer",
        "started",
        "Generating itinerary...",
    )

    prompt = f"""
You are an expert AI Travel Planner.

Write ONLY a short natural language summary.

Rules:
Rules:

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

{json.dumps(state["flights"][:2], indent=2)}

Hotels

{json.dumps(state["hotels"][:2], indent=2)}

Places

{json.dumps(state["places"][:5], indent=2)}

Weather

{json.dumps(state["weather"], indent=2)}

Recommended Profile

{state.get("recommended_profile", "")}

Recommended Itinerary

{json.dumps(state.get("recommended_itinerary", {}), indent=2)}

Alternative Itineraries

{json.dumps(state.get("multi_itineraries", [])[:3], indent=2)}
"""

    try:
        chunks = []

        try:
            llm = get_primary_llm(streaming=True)

            for chunk in llm.stream(prompt):
                text = chunk.content or ""

                if text:
                    chunks.append(text)

                    emit_token(
                        state,
                        text,
                    )

            logger.info("LLM Provider | Groq")

        except Exception as e:
            logger.warning(f"Groq unavailable | {e}")

            llm = get_fallback_llm(streaming=True)

            for chunk in llm.stream(prompt):
                text = chunk.content or ""

                if text:
                    chunks.append(text)

                    emit_token(
                        state,
                        text,
                    )

            logger.info("LLM Provider | NVIDIA NIM")

        state["final_response"] = "".join(chunks).strip()

        emit_progress(
            state,
            "composer",
            "completed",
        )

        return state

    except Exception:
        emit_progress(
            state,
            "composer",
            "failed",
        )
        raise