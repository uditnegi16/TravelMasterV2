"""
Calls the main app's PUBLIC API over real HTTP, exactly the way the
browser frontend does -- same endpoints, same guest-trial auth path
(Issue 1: no account required, device-scoped). This file imports
nothing from outside voice/ except the Python standard library and
httpx (already a transitive dependency of the main app's own
requirements.txt -- FastAPI/langchain pull it in; not re-declared
here to avoid touching that file, but noted here in case that ever
changes).

Deliberately does NOT import chat_service, core.auth, or anything
else from the main app -- if it did, deleting voice/ later could
still leave that coupling behind in someone's head even after the
files are gone. Every call below is something a `curl` command from
outside the app could reproduce.
"""

from __future__ import annotations

import asyncio
import uuid

import httpx

from voice.config import AGENT_API_BASE_URL, WEBHOOK_HTTP_TIMEOUT_SECONDS, ITINERARY_POLL_BUDGET_SECONDS


def _new_device_id() -> str:
    # One real, guest-trial-eligible device per voice conversation --
    # matches how a brand-new visitor's browser gets one real trip via
    # Issue 1's design. A single ElevenLabs conversation reusing the
    # same device_id across multiple tool calls stays within that same
    # one-trip allowance, same as a real guest would.
    return f"voice-{uuid.uuid4()}"


async def _create_guest_session(client: httpx.AsyncClient, device_id: str, title: str) -> str:
    response = await client.post(
        f"{AGENT_API_BASE_URL}/chat/sessions",
        json={"device_id": device_id, "title": title},
        timeout=WEBHOOK_HTTP_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()["id"]


async def _send_message(client: httpx.AsyncClient, session_id: str, device_id: str, query: str) -> dict:
    response = await client.post(
        f"{AGENT_API_BASE_URL}/chat/sessions/{session_id}/messages",
        json={"device_id": device_id, "query": query},
        timeout=WEBHOOK_HTTP_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


async def _fetch_latest_assistant_reply(client: httpx.AsyncClient, session_id: str, device_id: str) -> dict | None:
    response = await client.get(
        f"{AGENT_API_BASE_URL}/chat/sessions/{session_id}/messages",
        params={"device_id": device_id},
        timeout=WEBHOOK_HTTP_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    messages = response.json().get("messages", [])
    if messages and messages[-1].get("role") == "assistant":
        return messages[-1]
    return None


async def search_destinations(query_text: str) -> str:
    """
    Tool: search_destinations. Wraps a real chat turn phrased as an
    open question (not a planning request) -- the main app's own
    classify_message() routes this to GENERAL_CHAT, a single quick LLM
    call, same fast path regardless of whether the NEW_TRIP path is
    running synchronously or asynchronously elsewhere in the app.
    """
    device_id = _new_device_id()
    try:
        async with httpx.AsyncClient() as client:
            session_id = await _create_guest_session(client, device_id, query_text[:60])
            result = await _send_message(client, session_id, device_id, query_text)

        message = result.get("message") or {}
        content = message.get("content")
        if content:
            return content

        return "I didn't get a clear answer for that -- could you ask again?"

    except httpx.TimeoutException:
        return "That's taking a bit long to look up right now. Could you try asking again in a moment?"
    except httpx.HTTPStatusError:
        return "I ran into a problem looking that up. Could you try rephrasing the question?"
    except Exception:
        return "Something went wrong on my end. Please try again."


async def get_itinerary(query_text: str) -> str:
    """
    Tool: get_itinerary. Wraps a real chat turn phrased as a planning
    request -- classify_message() routes this to NEW_TRIP.

    Handles BOTH possible response shapes from the main app, since
    whether that path currently runs synchronously (full result in
    this response) or asynchronously (a "processing" ack, real result
    delivered over a WebSocket this sidecar never connects to -- by
    design, it only speaks HTTP) isn't something this adapter should
    assume either way. If queued, polls the messages endpoint for a
    bounded window rather than guessing; if it never resolves in that
    window, says so honestly instead of hanging.
    """
    device_id = _new_device_id()
    try:
        async with httpx.AsyncClient() as client:
            session_id = await _create_guest_session(client, device_id, query_text[:60])
            result = await _send_message(client, session_id, device_id, query_text)

            if result.get("status") == "processing":
                elapsed = 0.0
                poll_interval = 2.0
                while elapsed < ITINERARY_POLL_BUDGET_SECONDS:
                    await asyncio.sleep(poll_interval)
                    elapsed += poll_interval
                    reply = await _fetch_latest_assistant_reply(client, session_id, device_id)
                    if reply:
                        return _speakable_summary(reply)

                return (
                    "Your trip is still being planned -- that one's taking a little longer "
                    "than usual. Ask me again in a moment and I'll have it."
                )

            message = result.get("message") or {}
            return _speakable_summary(message)

    except httpx.TimeoutException:
        return "Planning that trip is taking too long right now. Please try again shortly."
    except httpx.HTTPStatusError:
        return "I ran into a problem planning that trip. Could you rephrase the request?"
    except Exception:
        return "Something went wrong on my end. Please try again."


def _speakable_summary(message: dict) -> str:
    content = message.get("content")
    if content:
        # Real trip content tends to be long-form/formatted for a
        # screen, not a phone call -- trims to something a voice agent
        # can actually say without droning on. A real product would
        # want a purpose-built short-summary field from the API
        # instead; out of scope for a removable sidecar that isn't
        # allowed to touch the existing response shape.
        return content[:400]
    return "I planned something, but couldn't put together a summary to read back. Check the app for the full itinerary."
