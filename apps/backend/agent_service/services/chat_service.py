"""
Chat History Service.

Talks to the `chat` schema (chat.sessions / chat.messages) added in
Objective: Chat UI + History Sidebar. Every function takes/returns
plain dicts, matching the style already used by vector_store_service.py
and V1's session_routes.py, rather than introducing a new ORM layer.

Ownership today is by `device_id` only (see database/schema.sql for
why account_id is present-but-unused). Every function that reads or
mutates a session verifies device_id ownership first, the same way
V1's `_assert_session_owner` guarded on account_id.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, cast

from fastapi import HTTPException
from llm.llm_client import get_fallback_llm, get_classifier_llm
from llm.prompts import INTENT_CLASSIFIER_PROMPT
from core.supabase_client import supabase
from shared.trip_summary import previous_trip_highlights
import json
import re
import logging
logger = logging.getLogger(__name__)
def _sessions_table():
    return supabase.schema("chat").table("sessions")


def _messages_table():
    return supabase.schema("chat").table("messages")


def assert_session_owner(session_id: str, device_id: str) -> Dict[str, Any]:
    """Raises 404 if the session doesn't exist or isn't owned by this device."""

    res = (
        _sessions_table()
        .select("*")
        .eq("id", session_id)
        .eq("device_id", device_id)
        .neq("status", "deleted")
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Session not found")
    return cast(Dict[str, Any], rows[0])


def list_sessions(device_id: str) -> List[Dict[str, Any]]:
    res = (
        _sessions_table()
        .select("id,title,status,pinned,last_message_at,created_at")
        .eq("device_id", device_id)
        .neq("status", "deleted")
        .order("pinned", desc=True)
        .order("last_message_at", desc=True)
        .execute()
    )
    return cast(List[Dict[str, Any]], getattr(res, "data", None) or [])


def create_session(device_id: str, title: Optional[str] = None) -> Dict[str, Any]:
    ins = (
        _sessions_table()
        .insert({"device_id": device_id, "title": (title or "New trip").strip()[:120]})
        .execute()
    )
    data = getattr(ins, "data", None) or []
    if not data:
        raise HTTPException(status_code=500, detail="Failed to create session")
    return cast(Dict[str, Any], data[0])


def rename_session(session_id: str, device_id: str, title: str) -> Dict[str, Any]:
    assert_session_owner(session_id, device_id)
    up = (
        _sessions_table()
        .update({"title": title.strip()[:120]})
        .eq("id", session_id)
        .execute()
    )
    data = getattr(up, "data", None) or []
    return cast(Dict[str, Any], data[0]) if data else {"id": session_id, "title": title}


def set_pinned(session_id: str, device_id: str, pinned: bool) -> Dict[str, Any]:
    assert_session_owner(session_id, device_id)
    up = _sessions_table().update({"pinned": pinned}).eq("id", session_id).execute()
    data = getattr(up, "data", None) or []
    return cast(Dict[str, Any], data[0]) if data else {"id": session_id, "pinned": pinned}


def archive_session(session_id: str, device_id: str) -> None:
    assert_session_owner(session_id, device_id)
    _sessions_table().update({"status": "archived"}).eq("id", session_id).execute()


def delete_session(session_id: str, device_id: str) -> None:
    # Soft delete — keeps the row (and its messages, via FK cascade
    # only fires on hard delete) so nothing is unrecoverable from a
    # misclick. Messages are left in place; list_sessions() and
    # assert_session_owner() both filter out status='deleted'.
    assert_session_owner(session_id, device_id)
    _sessions_table().update({"status": "deleted"}).eq("id", session_id).execute()


def touch_session(session_id: str) -> None:
    """Bumps last_message_at so the sidebar re-sorts to most-recent-first."""

    _sessions_table().update({"last_message_at": "now()"}).eq("id", session_id).execute()


def maybe_set_title_from_first_message(session_id: str, content: str) -> None:
    session = _sessions_table().select("title").eq("id", session_id).limit(1).execute()
    rows = getattr(session, "data", None) or []
    if rows and rows[0].get("title") == "New trip":
        auto_title = content.strip().replace("\n", " ")[:60] or "New trip"
        _sessions_table().update({"title": auto_title}).eq("id", session_id).execute()


def list_messages(session_id: str, device_id: str) -> List[Dict[str, Any]]:
    assert_session_owner(session_id, device_id)
    res = (
        _messages_table()
        .select("id,role,content,trip_data,created_at")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    return cast(List[Dict[str, Any]], getattr(res, "data", None) or [])


def add_message(
    session_id: str,
    role: str,
    content: str,
    trip_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    ins = (
        _messages_table()
        .insert(
            {
                "session_id": session_id,
                "role": role,
                "content": content,
                "trip_data": trip_data,
            }
        )
        .execute()
    )
    data = getattr(ins, "data", None) or []
    if not data:
        raise HTTPException(status_code=500, detail="Failed to write message")
    return cast(Dict[str, Any], data[0])
def get_last_trip(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Returns the latest assistant trip_data stored in this conversation.
    """

    res = (
        _messages_table()
        .select("trip_data")
        .eq("session_id", session_id)
        .eq("role", "assistant")
        .not_.is_("trip_data", "null")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    rows = getattr(res, "data", None) or []

    if not rows:
        return None

    return rows[0].get("trip_data")


def get_recent_history(
    session_id: str,
    limit: int = 12,
) -> List[Dict[str, Any]]:
    """
    Returns recent conversation history.
    """

    res = (
        _messages_table()
        .select("role,content")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    rows = getattr(res, "data", None) or []

    rows.reverse()

    return rows

def classify_message(
    query: str,
    previous_trip: Optional[Dict[str, Any]],
) -> str:
    """
    Uses a lightweight LLM call to determine how the
    current message should be handled.
    """

    if previous_trip is None:
    # No existing itinerary. We still need to distinguish between
    # someone starting a trip planning conversation and someone
    # simply chatting.

        llm = get_classifier_llm(streaming=False)

        prompt = f"""
    {INTENT_CLASSIFIER_PROMPT}

    Current User Message

    {query}

    There is NO existing trip.

    Return exactly one label.

    Allowed labels:
    NEW_TRIP
    GENERAL_CHAT
    """

        try:
            response = llm.invoke(prompt)
            logger.info("Classifier Raw | %s", response.content)

            intent = (response.content or "").strip().upper()

            if intent in {"NEW_TRIP", "GENERAL_CHAT"}:
                logger.info("Classifier Intent | %s", intent)
                return intent

        except Exception as e:
            logger.warning("Classifier failed | %s", e)

        heuristic = _heuristic_classify(query)
        logger.info("Classifier Fallback -> %s", heuristic)

        if heuristic in {"NEW_TRIP", "GENERAL_CHAT"}:
            return heuristic

        return "GENERAL_CHAT"


    llm = get_classifier_llm(streaming=False)

    # Only a small summary goes into the classifier prompt - the full
    # previous_trip (parsed_trip + itinerary + multi_itineraries) can be
    # 5-10k+ tokens on its own once a few hotels/flights are attached,
    # which was quietly eating into the same daily Groq token budget
    # every single message uses, modification or not.
    trip_summary = previous_trip_highlights(previous_trip)

    prompt = f"""
{INTENT_CLASSIFIER_PROMPT}

Current User Message

{query}

Current Trip (summary)

{trip_summary}

Return exactly one label.
"""

    allowed = {
        "NEW_TRIP",
        "MODIFY_TRIP",
        "FOLLOW_UP",
        "GENERAL_CHAT",
    }

    try:

        response = llm.invoke(prompt)
        logger.info("Classifier Raw | %s", response.content)

        intent = (response.content or "").strip().upper()

        if intent in allowed:
            logger.info("Classifier Intent | %s", intent)
            return intent

    except Exception as e:
        logger.warning("Classifier Groq failed, trying NVIDIA fallback | %s", e)

        try:
            # Short timeout on purpose: this is a routing decision, not
            # a generated answer, so it's not worth waiting the client's
            # default 60s to find out NVIDIA is also unavailable - fail
            # fast and let the heuristic below make the call instead.
            fallback_llm = get_fallback_llm(streaming=False, timeout=10)
            response = fallback_llm.invoke(prompt)
            logger.info("Classifier Raw (NVIDIA) | %s", response.content)

            intent = (response.content or "").strip().upper()

            if intent in allowed:
                logger.info("Classifier Intent (NVIDIA) | %s", intent)
                return intent

        except Exception:
            logger.exception("Classifier Failed on both Groq and NVIDIA")

    #
    # Both LLMs are unavailable. Falling back to FOLLOW_UP unconditionally
    # silently swallows MODIFY_TRIP/NEW_TRIP requests (e.g. "change the
    # flight to luxury", "make it for 3 travelers instead" both got
    # misrouted this way). A cheap keyword heuristic won't be as accurate
    # as the LLM, but it's a much better guess than always assuming
    # FOLLOW_UP.
    #

    heuristic = _heuristic_classify(query)
    logger.info("Classifier Fallback -> %s (heuristic)", heuristic)
    return heuristic


_MODIFY_KEYWORDS = (
    "change", "instead", "make it", "switch to", "upgrade", "downgrade",
    "increase", "decrease", "reduce", "extend", "shorten", "add ",
    "remove", "cheaper", "luxury", "more days", "fewer days",
    "different hotel", "different flight", "move to", "budget to",
)

_NEW_TRIP_KEYWORDS = (
    "plan a trip", "plan my", "new trip", "suggest a", "want to travel",
    "want to visit", "book a trip",
)


def _heuristic_classify(query: str) -> str:
    """
    Last-resort keyword classifier, only used when both the primary and
    fallback LLMs are unreachable. Errs toward MODIFY_TRIP over FOLLOW_UP
    for anything that looks like a change request, since silently
    treating a modification as a question is the worse failure mode
    (the user's requested change is just dropped).
    """

    q = query.lower().strip()

    if any(kw in q for kw in _NEW_TRIP_KEYWORDS):
        return "NEW_TRIP"

    if any(kw in q for kw in _MODIFY_KEYWORDS):
        return "MODIFY_TRIP"

    if q.endswith("?") or q.startswith(("can i", "can we", "how", "what", "why", "is it", "will")):
        return "FOLLOW_UP"

    return "FOLLOW_UP"
def get_message_by_id(
    message_id: str,
) -> Dict[str, Any]:
    """
    Returns a single stored chat message.
    """

    response = (
        _messages_table()
        .select("*")
        .eq("id", message_id)
        .single()
        .execute()
    )

    if not response.data:
        raise ValueError("Message not found")

    return response.data

import secrets
def create_share_token(
    message_id: str,
) -> str:
    """
    Creates a public share token for a trip snapshot.
    """

    token = secrets.token_urlsafe(16)

    (
        _messages_table()
        .update(
            {
                "share_token": token,
            }
        )
        .eq("id", message_id)
        .execute()
    )

    return token
def get_message_by_share_token(
    token: str,
):
    response = (
        _messages_table()
        .select("*")
        .eq("share_token", token)
        .single()
        .execute()
    )

    if not response.data:
        raise ValueError("Invalid share token")

    return response.data
def create_share_token(
    message_id: str,
) -> str:
    import secrets

    token = secrets.token_urlsafe(16)

    (
        _messages_table()
        .update(
            {
                "share_token": token,
            }
        )
        .eq("id", message_id)
        .execute()
    )

    return token
def get_message_by_share_token(
    token: str,
):
    response = (
        _messages_table()
        .select("*")
        .eq("share_token", token)
        .single()
        .execute()
    )

    if not response.data:
        raise ValueError("Invalid share token")

    return response.data