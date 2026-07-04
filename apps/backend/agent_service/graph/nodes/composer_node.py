import json

from llm.llm_client import get_primary_llm, get_fallback_llm
from shared.logging_config import logger


def composer_node(state):
    prompt = f"""
You are an expert AI Travel Planner.

Write ONLY a short natural language summary.

Rules:
- Write a personalized travel recommendation.
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

Trip Request

{json.dumps(state["parsed_trip"], indent=2)}

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

Weather

{json.dumps(state["weather"], indent=2)}
"""

    try:
        llm = get_primary_llm()

        response = llm.invoke(prompt)

        logger.info("LLM Provider | Groq")

    except Exception as e:

        logger.warning(f"Groq unavailable | {e}")

        llm = get_fallback_llm()

        response = llm.invoke(prompt)

        logger.info("LLM Provider | NVIDIA NIM")

    state["final_response"] = response.content.strip()

    return state