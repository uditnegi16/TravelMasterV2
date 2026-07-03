import json

from llm.llm_client import get_primary_llm, get_fallback_llm
from shared.logging_config import logger


def composer_node(state):
    prompt = f"""
You are an expert AI Travel Planner.

Write ONLY a short natural language summary.

Rules:

- Do NOT use Markdown.
- Do NOT use headings.
- Do NOT write lists.
- Do NOT mention sections.
- Speak naturally like ChatGPT.

Maximum 150 words.

Trip

{json.dumps(state["parsed_trip"], indent=2)}

Flight

{json.dumps(state["flights"][:1], indent=2)}

Hotel

{json.dumps(state["hotels"][:1], indent=2)}

Places

{json.dumps(state["places"][:3], indent=2)}

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