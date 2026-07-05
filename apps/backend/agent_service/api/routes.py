import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from core.redis_client import redis_client
from api.schemas import GeneratePdfRequest, TripRequest, TripResponse
from graph.build_graph import build_graph
from services.pdf_builder import build_trip_pdf
from services.response_builder import build_response

import asyncio

from api.websocket_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()

graph = build_graph()


@router.post("/plan-trip")
def plan_trip(request: Request, body: TripRequest):
    client_ip = body.session_id

    rate_key = f"travelguru:v2:rate:{client_ip}"

    current = redis_client.incr(rate_key)

    if current == 1:
        redis_client.expire(rate_key, 60)

    if current > 5:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again in a minute.",
        )

    def progress_callback(event):
        # Phase 5 fix: this callback is passed directly into graph
        # state, so it is only ever invoked for THIS request/session.
        # We no longer subscribe it to a global emitter (that caused
        # every active session to receive every other session's
        # events, plus double-delivery to this one).
        #
        # We also no longer call asyncio.run() here, which created a
        # brand new event loop for every single progress/token event
        # (very expensive once streaming tokens start flowing).
        # Instead we schedule the send onto FastAPI's already-running
        # event loop, captured at startup in manager.loop.
        if manager.loop is None:
            return

        try:
            asyncio.run_coroutine_threadsafe(
                manager.send(body.session_id, event),
                manager.loop,
            )
        except Exception:
            pass

    state = {
        "user_query": body.query,
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

    result = graph.invoke(state)

    return build_response(result)


def _emit_pdf_event(session_id: str, event: dict) -> None:
    """
    Objective 5.4 — same event-loop-bridging pattern as plan_trip's
    progress_callback above (Section 11 Bug #3 fix from the Phase 5
    handoff): reuse the event loop captured at startup, never
    asyncio.run() per event, and only ever send to this session_id.
    """
    if manager.loop is None:
        return

    try:
        asyncio.run_coroutine_threadsafe(
            manager.send(session_id, event),
            manager.loop,
        )
    except Exception:
        pass


def _generate_pdf_task(session_id: str, trip: dict) -> None:
    """
    Runs in FastAPI's BackgroundTasks threadpool after /generate-pdf
    has already returned its 202-style response to the caller.

    Deliberately does NOT re-call the LLM or re-fetch trip data — it
    only formats what /plan-trip already produced, per this phase's
    scope decision (finish & stabilize 5.1-5.7, no new content-
    generation surface area).
    """
    _emit_pdf_event(session_id, {
        "type": "progress",
        "stage": "pdf",
        "status": "started",
        "message": "Generating your itinerary PDF...",
    })

    try:
        build_trip_pdf(session_id, trip)
    except Exception as exc:
        logger.exception(
            "PDF generation failed for session_id=%s", session_id
        )
        _emit_pdf_event(session_id, {
            "type": "progress",
            "stage": "pdf",
            "status": "failed",
            "message": f"PDF generation failed: {exc}",
        })
        return

    _emit_pdf_event(session_id, {
        "type": "progress",
        "stage": "pdf",
        "status": "completed",
        "message": "Your itinerary PDF is ready.",
        "download_url": f"/download-pdf/{session_id}",
    })


@router.post("/generate-pdf")
def generate_pdf(body: GeneratePdfRequest, background_tasks: BackgroundTasks):
    """
    Objective 5.4 — Async PDF Generation.

    Fire-and-forget: kicks off PDF rendering in the background and
    returns immediately. Progress ("started" -> "completed"/"failed")
    is delivered over the SAME /ws/progress/{session_id} channel
    already opened for the /plan-trip request, using the existing
    "pdf" stage convention from the Phase 5 architecture.

    Frontend is expected to call this AFTER TripResult has rendered,
    passing back the exact `trip` object it already received from
    /plan-trip's response — no server-side caching/store was added
    for this, to avoid new infra.
    """
    background_tasks.add_task(_generate_pdf_task, body.session_id, body.trip)
    return {"success": True, "message": "PDF generation started."}