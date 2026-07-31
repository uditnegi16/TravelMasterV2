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

from fastapi import APIRouter, HTTPException, Query

from api.chat_schemas import (
    CreateSessionRequest,
    DeviceScopedRequest,
    PinSessionRequest,
    RenameSessionRequest,
    SendMessageRequest,
)
from api.routes import graph
from api.websocket_manager import manager
from services import chat_service
from services.response_builder import build_response
from graph.nodes.qa_node import itinerary_qa_node, general_chat_node
from fastapi.responses import RedirectResponse
from fastapi import Request
from services.pdf_builder import build_trip_pdf, upload_pdf_and_get_presigned_url
from fastapi import Depends
from core.auth import get_current_user, get_account_id
from shared import metrics
import time
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


# -------------------------
# Sessions
# -------------------------
@router.get("/sessions")
def get_sessions(
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    return {"sessions": chat_service.list_sessions(account_id)}


@router.post("/sessions")
def post_session(
    body: CreateSessionRequest,
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    return chat_service.create_session(account_id, body.device_id, body.title)


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
    user=Depends(get_current_user),
):
    account_id = get_account_id(user)
    return {"messages": chat_service.list_messages(session_id, account_id)}


def _emit(session_id: str, event: dict) -> None:
    if manager.loop is None:
        return
    try:
        asyncio.run_coroutine_threadsafe(manager.send(session_id, event), manager.loop)
    except Exception:
        pass


@router.post("/sessions/{session_id}/messages")
def post_message(
    session_id: str,
    body: SendMessageRequest,
    user=Depends(get_current_user),
):
    """
    Sends a user query into an existing session, runs the agent graph,
    and stores both the user turn and the assistant turn (with its
    trip_data) before returning the result. Progress/token events for
    this turn stream over the existing /ws/progress/{session_id}
    socket, same as /plan-trip.
    """

    turn_started = time.perf_counter()

    account_id = get_account_id(user)
    session = chat_service.assert_session_owner(session_id, account_id)

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

        if conversation_type == "NEW_TRIP":

            result = graph.invoke(state)
            response = build_response(result)

        elif conversation_type == "MODIFY_TRIP":

            # trip_modifier_node (wired into the graph's entry routing)
            # takes it from here - it merges the user's request with
            # previous_trip["parsed_trip"] before the planner/tool
            # pipeline runs, instead of the planner re-extracting from
            # just the latest message.
            result = graph.invoke(state)
            response = build_response(result)

        elif conversation_type == "FOLLOW_UP":

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
):
    message = chat_service.get_message_by_id(message_id)

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

    # Redirect rather than stream the file through API Gateway/Lambda --
    # verified live on 2026-07-31 that FileResponse here produces a
    # downloaded file containing the raw base64 response body, never
    # decoded to binary. window.open() on the frontend follows this
    # redirect transparently, so no frontend change is needed.
    return RedirectResponse(url=presigned_url, status_code=307)
@router.post("/messages/{message_id}/share")
def create_share_link(
    request: Request,
    message_id: str,
):
    message = chat_service.get_message_by_id(message_id)

    if not message.get("trip_data"):
        raise HTTPException(
            status_code=404,
            detail="Trip snapshot not found.",
        )

    token = message.get("share_token")

    if not token:
        token = chat_service.create_share_token(message_id)

    base = str(request.base_url).rstrip("/")

    return {
    "url": f"http://localhost:5173/share/{token}",
    }
@router.get("/share/{token}")
def get_shared_trip(
    token: str,
):
    message = chat_service.get_message_by_share_token(token)

    return {
        "trip": message.get("trip_data"),
        "summary": message.get("content"),
    }