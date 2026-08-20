"""
The actual heavy-lifting work for a NEW_TRIP/MODIFY_TRIP chat turn --
extracted out of chat_routes.py::post_message so it can run as a
separate, asynchronously-invoked Lambda execution instead of blocking
the original HTTP request/response cycle.

Why this exists: a real end-to-end load test against live production
found that the full multi-agent pipeline (parallel flight/hotel/place/
weather search + planner + composer LLM calls) regularly takes
20-29+ seconds -- and, confirmed again in a later real local test,
some international-destination requests take 20-80+ seconds. Close
enough to AWS API Gateway's hard ~29-second REST integration timeout
that a real fraction of requests were failing outright, cut off by
API Gateway before the Lambda even finished. The fix isn't to make
the pipeline faster (a separate, real effort) or to raise the timeout
(which just delays the same problem) -- it's to stop waiting on it
synchronously at all. The HTTP request now returns almost immediately
once quota/ownership are confirmed and the turn is queued; this
module does the actual work in a second, asynchronously-invoked
execution, and delivers the result over the WebSocket connection the
frontend already holds open for progress events -- which isn't
subject to the REST API's integration timeout at all.

Only NEW_TRIP/MODIFY_TRIP route through this -- FOLLOW_UP/
INFO_REQUEST/GENERAL_CHAT are single quick calls (a few seconds at
most) that were never the cause of the timeout, so they stay
synchronous, no reason to add async complexity to paths that were
never slow.
"""

from __future__ import annotations

import logging
from typing import Any

from api.routes import graph
from api.websocket_manager import manager
from services import chat_service
from services.response_builder import build_response
from shared import quota_guard

logger = logging.getLogger(__name__)


async def process_message_turn(payload: dict[str, Any]) -> None:
    """
    Runs the actual graph invocation for one NEW_TRIP/MODIFY_TRIP turn
    and delivers the result over the session's WebSocket connection.
    Called from a separate, asynchronous Lambda execution (see
    core/async_invoke.py) -- never runs inline in the request that
    queued it, so nothing here can be awaited by an HTTP caller.

    Always writes the final message to the database regardless of
    whether the WebSocket delivery succeeds (the frontend's fallback
    is to re-fetch messages via the normal GET endpoint if no
    WebSocket event arrives in time) -- delivery-over-the-socket is a
    nice-to-have UX optimization, not the source of truth.
    """
    session_id = payload["session_id"]
    account_id = payload.get("account_id")  # None for a guest turn
    is_billable_turn = payload["is_billable_turn"]

    state = {
        "user_query": payload["query"],
        "conversation_type": payload["conversation_type"],
        "previous_trip": payload.get("previous_trip"),
        "conversation_history": payload.get("conversation_history") or [],
        "parsed_trip": {},
        "tools_to_call": [],
        "flights": [],
        "hotels": [],
        "places": [],
        "weather": {},
        "final_response": "",
        "errors": [],
        "progress_callback": lambda event: _emit_async(session_id, event),
    }

    try:
        result = graph.invoke(state)
        response = build_response(result)

        trip = response.get("trip") if isinstance(response, dict) else None
        summary = (
            response.get("summary")
            or (trip or {}).get("summary")
            or "Here's what I found."
        )

        assistant_message = chat_service.add_message(
            session_id,
            "assistant",
            summary,
            trip_data=trip,
        )
        chat_service.touch_session(session_id)

        try:
            await manager.send(
                session_id,
                {"type": "result", "message": assistant_message, **response},
            )
        except Exception:
            pass

    except Exception:
        logger.exception(
            "Async message worker failed for session_id=%s",
            session_id,
        )

        if account_id and is_billable_turn:
            quota_guard.refund_quota(account_id)

        error_message = chat_service.add_message(
            session_id,
            "assistant",
            "Sorry, something went wrong planning that trip. Please try again.",
        )

        try:
            await manager.send(
                session_id,
                {"type": "error", "message": error_message},
            )
        except Exception:
            pass


def _emit_async(session_id: str, event: dict) -> None:
    """
    progress_callback is a plain sync function (graph nodes call it
    directly, not with await), but this worker's own send() needs to
    be async -- schedules the send on whatever event loop is currently
    running rather than blocking the graph's own execution on it.
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        loop.create_task(manager.send(session_id, event))
    except Exception:
        pass
