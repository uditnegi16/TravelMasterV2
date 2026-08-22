"""
Chat UI + History Sidebar — API routes.

Session-aware version of what /plan-trip already does. A session is
created once per conversation (not once per query, the way the old
sessionId in PlanTripPage.tsx worked), and every user/assistant turn
is persisted to chat.sessions / chat.messages so the sidebar can list
past conversations and reopen them with full history.

Reuses the SAME agent graph instance and websocket ConnectionManager
as /plan-trip in routes.py — progress/token events still stream over
/ws/progress/{session_id} exactly as before. Nothing about the agent
pipeline itself changes; this layer only adds persistence around it.
"""

from __future__ import annotations

import asyncio
import logging
import os

from fastapi import APIRouter, HTTPException, Query

from api.chat_schemas import (
    CreateSessionRequest,
    DeviceScopedRequest,
    PinSessionRequest,
    RenameSessionRequest,
    SendMessageRequest,
)
from api.websocket_manager import manager
from services import chat_service
from graph.nodes.qa_node import itinerary_qa_node, general_chat_node
from graph.nodes.info_request_node import info_request_node
from fastapi import Request
from services.pdf_builder import build_trip_pdf, upload_pdf_and_get_presigned_url
from fastapi import Depends
from core.auth import get_current_user, get_current_user_optional, get_account_id, get_clerk_user_id
from core.async_invoke import invoke_message_worker
from shared import quota_guard
from shared import metrics
import time
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


# -------------------------
# Sessions
# -------------------------
@router.get("/quota")
def get_quota(
    user=Depends(get_current_user),
):
    """
    Read-only -- does not consume a slot. Guests have no account-based
    quota to report (Issue 1's one-session allowance is a separate,
    device-keyed mechanism); this endpoint requires real auth.
    """
    account_id = get_account_id(user)
    return quota_guard.get_quota_status(account_id, get_clerk_user_id(user))


@router.get("/sessions")
def get_sessions(
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    return {"sessions": chat_service.list_sessions(account_id)}


@router.post("/sessions")
def post_session(
    body: CreateSessionRequest,
    user=Depends(get_current_user_optional),
):
    if user is not None:
        account_id = get_account_id(user)
        return chat_service.create_session(account_id, body.device_id, body.title)

    # Issue 1: guest trial -- one free trip, no account required.
    # Gated here (creation), not on message-sending, so a guest can
    # have a full back-and-forth conversation about their one trip
    # without hitting a wall mid-conversation; starting a SECOND
    # session is what actually requires sign-in.
    if chat_service.has_used_guest_trial(body.device_id):
        raise HTTPException(
            status_code=403,
            detail="Guest trial already used. Sign in to keep planning trips.",
        )
    return chat_service.create_guest_session(body.device_id, body.title)


@router.get("/sessions/claimable")
def get_claimable_sessions(
    device_id: str = Query(...),
    user=Depends(get_current_user),
):
    """
    Powers the explicit "import your previous trips?" prompt -- read
    only, never claims anything itself. See POST /sessions/claim for
    the actual, user-confirmed migration action.
    """
    account_id = get_account_id(user)
    return {"claimable": chat_service.find_claimable_sessions(device_id, account_id)}


@router.post("/sessions/claim")
def post_claim_sessions(
    body: DeviceScopedRequest,
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    claimed = chat_service.claim_sessions(body.device_id, account_id)
    return {"claimed": claimed}


@router.patch("/sessions/{session_id}")
def patch_session(
    session_id: str,
    body: RenameSessionRequest,
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    return chat_service.rename_session(session_id, account_id, body.title)


@router.patch("/sessions/{session_id}/pin")
def patch_session_pin(
    session_id: str,
    body: PinSessionRequest,
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    return chat_service.set_pinned(session_id, account_id, body.pinned)


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    chat_service.delete_session(session_id, account_id)
    return {"ok": True, "deleted": session_id}


# -------------------------
# Messages
# -------------------------
@router.get("/sessions/{session_id}/messages")
def get_messages(
    session_id: str,
    device_id: str = Query(...),
    user=Depends(get_current_user_optional),
):
    if user is not None:
        account_id = get_account_id(user)
        return {"messages": chat_service.list_messages(session_id, account_id)}

    return {"messages": chat_service.list_guest_messages(session_id, device_id)}


def _emit(session_id: str, event: dict) -> None:
    if manager.loop is None:
        return
    try:
        asyncio.run_coroutine_threadsafe(manager.send(session_id, event), manager.loop)
    except Exception:
        pass


@router.post("/sessions/{session_id}/messages") #after FRONTEND control flow comes here
def post_message(
    session_id: str,
    body: SendMessageRequest,
    user=Depends(get_current_user_optional),
):
    """
    Sends a user query into an existing session, runs the agent graph,
    and stores both the user turn and the assistant turn (with its
    trip_data) before returning the result. Progress/token events for
    this turn stream over the existing /ws/progress/{session_id}
    socket, same as /plan-trip.

    Works for both authenticated users and guests continuing their one
    free-trial session (Issue 1) -- ownership check differs by path,
    everything downstream (graph invocation, message storage) is
    identical either way.
    """

    turn_started = time.perf_counter()

    if user is not None:
        account_id = get_account_id(user)
        session = chat_service.assert_session_owner(session_id, account_id)
    else:
        account_id = None
        session = chat_service.assert_guest_session_owner(session_id, body.device_id)

    chat_service.add_message(session_id, "user", body.query)
    chat_service.maybe_set_title_from_first_message(session_id, body.query)

    previous_trip = chat_service.get_last_trip(session_id)

    conversation_type = chat_service.classify_message(
    query=body.query,
    previous_trip=previous_trip,
    )
    metrics.increment_bucket("conversation_type", conversation_type)

    logger.info(
        "Conversation Type | %s",
        conversation_type,
    )

    # Issue 5: only NEW_TRIP/MODIFY_TRIP consume quota -- these are the
    # actual "trip plans" the 7/100 monthly numbers describe.
    # FOLLOW_UP/GENERAL_CHAT are lightweight conversation about an
    # existing trip, free either way, consistent with Issue 1's guest
    # design (a full conversation about one trip, not just one message).
    # Only applies to authenticated accounts -- guests (Issue 1) have
    # their own, entirely separate one-session allowance keyed by
    # device_id, not account_id; this simply never runs for the guest
    # path above, so nothing here can affect it.
    is_billable_turn = conversation_type in ("NEW_TRIP", "MODIFY_TRIP")
    if user is not None and is_billable_turn:
        quota_guard.check_and_increment_quota(account_id, get_clerk_user_id(user))

    if is_billable_turn:
        # Quota is already spent/checked above -- from here it's
        # queued, not run inline. If the worker itself fails, it
        # refunds the quota and delivers an error message over the
        # socket, same as the old inline except path used to.
        invoke_message_worker(
            {
                "session_id": session_id,
                "query": body.query,
                "conversation_type": conversation_type,
                "account_id": account_id,
                "is_billable_turn": is_billable_turn,
            }
        )

        return {
            "session": session,
            "status": "processing",
            "conversation_type": conversation_type,
        }

    conversation_history = chat_service.get_recent_history(
        session_id,
    )

    def progress_callback(event):
        _emit(session_id, event)

    state = {
        "user_query": body.query,
        "conversation_type": conversation_type,
        "previous_trip": previous_trip,
        "conversation_history": conversation_history,
        "parsed_trip": {},
        "tools_to_call": [],
        "flights": [],
        "hotels": [],
        "places": [],
        "weather": {},
        "final_response": "",
        "errors": [],
        "progress_callback": progress_callback,
    }

    try:

        if conversation_type == "FOLLOW_UP":

            # Answers using the current itinerary + RAG + general LLM
            # knowledge, like a normal chat assistant - no tools, no
            # re-running the planner, and no re-sending trip cards
            # since nothing about the trip changed.
            answer = itinerary_qa_node(state)

            response = {
                "success": True,
                "trip": None,
                "summary": answer,
            }

        elif conversation_type == "INFO_REQUEST":

            # A follow-up that needs real, fresh data the existing
            # trip doesn't have (2026-08-19) - calls exactly ONE real
            # tool (whichever the question is about), not the full
            # flight+hotel+places+weather pipeline. Deliberately NOT
            # routed to MODIFY_TRIP: that means "change my plan," a
            # different thing, and would burn real API calls and LLM
            # tokens disproportionate to a single follow-up question.
            answer = info_request_node(state)

            response = {
                "success": True,
                "trip": None,
                "summary": answer,
            }

        else:

            # GENERAL_CHAT - open-ended conversation, not tied to any
            # itinerary. Plain chat answer, no trip cards.
            answer = general_chat_node(state)

            response = {
                "success": True,
                "trip": None,
                "summary": answer,
            }

    except Exception as exc:
        metrics.increment("chat_turn_errors")
        logger.exception(
            "Agent graph failed for session_id=%s",
            session_id,
        )

        chat_service.add_message(
            session_id,
            "assistant",
            "Sorry, something went wrong planning that trip. Please try again.",
        )

        raise HTTPException(
            status_code=500,
            detail="Something went wrong on our end. Please try again in a moment.",
        ) from exc

    trip = response.get("trip") if isinstance(response, dict) else None
    summary = (
        response.get("summary")
        or (trip or {}).get("summary")
        or "Here's what I found."
    )

    assistant_message = chat_service.add_message(
        session_id, "assistant", summary, trip_data=trip
    )
    assistant_message_id = assistant_message["id"]
    chat_service.touch_session(session_id)

    metrics.record_latency(
        "chat_turn",
        (time.perf_counter() - turn_started) * 1000,
        {"conversation_type": conversation_type},
    )
    metrics.increment("chat_turn_success")

    return {
        "session": session,
        "message": assistant_message,
        **response,
    }
@router.get("/messages/{message_id}/pdf")
def download_trip_pdf(
    message_id: str,
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    message = chat_service.get_owned_message(message_id, account_id)

    trip = message.get("trip_data")

    if not trip:
        raise HTTPException(
            status_code=404,
            detail="Trip snapshot not found.",
        )

    pdf_path = build_trip_pdf(
        message_id,
        trip,
    )

    presigned_url = upload_pdf_and_get_presigned_url(
        message_id,
        pdf_path,
    )

    # Returns the URL as JSON rather than an HTTP redirect. A redirect
    # would require the frontend's fetch() (needed here since this
    # route requires an Authorization header, which window.open() can't
    # attach) to follow it cross-origin and read response.url -- which
    # depends on the S3 bucket having CORS configured for the frontend's
    # origin, unverified and fragile. JSON sidesteps that: the frontend
    # gets the URL as data and does its own window.open(), a top-level
    # navigation that never needs CORS at all.
    return {"url": presigned_url}
@router.post("/messages/{message_id}/share")
def create_share_link(
    request: Request,
    message_id: str,
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    message = chat_service.get_owned_message(message_id, account_id)

    if not message.get("trip_data"):
        raise HTTPException(
            status_code=404,
            detail="Trip snapshot not found.",
        )

    # Every call issues a fresh token (see create_share_token's
    # docstring -- raw tokens are never stored, so there's no previous
    # plaintext to return even if one already existed).
    token = chat_service.create_share_token(message_id)

    # APP_URL, if configured, wins -- request.base_url reflects
    # whatever domain the API itself is reached at (the backend's
    # domain), not the frontend's, so it was never actually correct
    # here even before the hardcoded-localhost bug.
    base = os.getenv("APP_URL") or "https://main.d2dqny356lcrsz.amplifyapp.com"

    return {
        "url": f"{base}/share/{token}",
    }
@router.get("/share/{token}")
def get_shared_trip(
    token: str,
):
    """
    Deliberately public, no auth dependency -- this endpoint IS the
    share link. Access control is the token itself: high-entropy,
    hashed at rest, expiring, revocable. Returns 410 (not 404) for
    invalid/expired/revoked tokens -- distinct from "never existed",
    matching the acceptance criteria's "controlled 404/410 state."
    """
    message = chat_service.get_message_by_share_token(token)

    if not message:
        raise HTTPException(
            status_code=410,
            detail="This share link is invalid or has expired.",
        )

    return {
        "trip": message.get("trip_data"),
        "summary": message.get("content"),
    }