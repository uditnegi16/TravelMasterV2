"""
Chat-style nodes for turns that don't need the full planning pipeline:

- itinerary_qa_node  -> FOLLOW_UP  (question about the current trip)
- general_chat_node  -> GENERAL_CHAT (anything else, travel-related or not)

Neither one touches flights/hotels/places/weather tools or the
composer - they answer directly (RAG + LLM), the way a normal chat
assistant would, and are called straight from chat_routes.py instead
of going through build_graph()'s graph.invoke().
"""

from llm.llm_client import get_primary_llm, get_fallback_llm
from llm.prompts import ITINERARY_QA_SYSTEM_PROMPT, GENERAL_CHAT_SYSTEM_PROMPT
from retrieval.context_builder import ContextBuilder
from retrieval.retriever import SemanticRetriever
from graph.progress_utils import emit_progress, emit_token
from shared.logging_config import logger

_retriever = SemanticRetriever()


def _search_knowledge(query: str) -> str:
    try:
        documents = _retriever.search(query)
        return ContextBuilder.build(documents)
    except Exception:
        logger.warning("RAG lookup failed for chat turn, continuing without it")
        return ""


def _run_chat_llm(state: dict, system_prompt: str, human_prompt: str, stage: str) -> str:
    emit_progress(state, stage, "started", "Thinking...")

    chunks = []
    degraded = False

    try:
        llm = get_primary_llm(streaming=True, timeout=20)
        for chunk in llm.stream([("system", system_prompt), ("human", human_prompt)]):
            text = chunk.content or ""
            if text:
                chunks.append(text)
                emit_token(state, text)

    except Exception as e:
        logger.warning(f"Groq unavailable for {stage} | {e}")

        try:
            llm = get_fallback_llm(streaming=True, timeout=20)
            for chunk in llm.stream([("system", system_prompt), ("human", human_prompt)]):
                text = chunk.content or ""
                if text:
                    chunks.append(text)
                    emit_token(state, text)

        except Exception as fallback_exc:
            logger.error(f"{stage} unavailable on both Groq and NVIDIA | {fallback_exc}")
            chunks = []
            degraded = True

    emit_progress(state, stage, "completed_degraded" if degraded else "completed")

    if chunks:
        return "".join(chunks).strip()
    if degraded:
        return (
            "Sorry, I can't reach the AI provider right now (it's temporarily "
            "unavailable or rate-limited). Please try asking again in a moment."
        )
    return ""


def itinerary_qa_node(state: dict) -> str:
    """FOLLOW_UP: answer using the current itinerary + travel knowledge
    (RAG) + the LLM's own general knowledge - like ChatGPT would,
    grounded in the trip that's already been planned."""

    query = state["user_query"]
    previous_trip = state.get("previous_trip") or {}
    travel_knowledge = _search_knowledge(query)

    human_prompt = f"""
Current Itinerary (structured):
{previous_trip.get("parsed_trip", {})}

Current Plan Summary:
{previous_trip.get("summary", "")}

Travel Knowledge (reference material, use if relevant):
{travel_knowledge}

User's Question:
{query}
"""

    return _run_chat_llm(state, ITINERARY_QA_SYSTEM_PROMPT, human_prompt, "itinerary_qa")


def general_chat_node(state: dict) -> str:
    """GENERAL_CHAT: open-ended conversation, not tied to a specific
    itinerary - no trip cards, just a normal chat answer."""

    query = state["user_query"]
    travel_knowledge = _search_knowledge(query)

    human_prompt = f"""
Travel Knowledge (reference material, only use if relevant to the question):
{travel_knowledge}

User:
{query}
"""

    return _run_chat_llm(state, GENERAL_CHAT_SYSTEM_PROMPT, human_prompt, "general_chat")