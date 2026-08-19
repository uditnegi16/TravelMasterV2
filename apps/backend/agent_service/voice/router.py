"""
Webhook tool endpoints for an ElevenLabs conversational agent.

Confirmed against ElevenLabs' real docs (2026-08-11,
elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools):
webhook tools are plain HTTP endpoints -- the agent generates
structured body/path/query parameters from the conversation based on
the parameter descriptions configured in the ElevenLabs dashboard, and
calls the endpoint like any normal client. No special envelope format
is required; this is a normal FastAPI router.

Each endpoint here is a thin translator: structured tool params in,
one real chat turn against the main app's own public API (via
voice/adapter.py), one short speakable string out. Nothing here talks
to a database, imports chat_service, or does anything the main app's
own frontend couldn't already do over the same public endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from voice.adapter import get_itinerary as _get_itinerary
from voice.adapter import search_destinations as _search_destinations

router = APIRouter(prefix="/voice/tools", tags=["Voice Tools"])


class SearchDestinationsRequest(BaseModel):
    destination: str
    question: str = "What's it like, and what's it known for?"


class SearchDestinationsResponse(BaseModel):
    answer: str


@router.post("/search_destinations", response_model=SearchDestinationsResponse)
async def search_destinations(body: SearchDestinationsRequest):
    """
    ElevenLabs tool config (dashboard):
      Name: search_destinations
      Description: Answers general questions about a travel destination
        (what it's like, what it's known for, best time to visit) --
        NOT for building a full trip itinerary, use get_itinerary for that.
      Method: POST
      Body params (LLM-filled):
        destination (string, required) -- the place being asked about
        question (string, optional) -- the specific thing being asked
    """
    query_text = f"Tell me about {body.destination}: {body.question}"
    answer = await _search_destinations(query_text)
    return SearchDestinationsResponse(answer=answer)


class GetItineraryRequest(BaseModel):
    origin: str
    destination: str
    travel_dates: str
    travelers: str = "1 adult"
    budget: str = "flexible"


class GetItineraryResponse(BaseModel):
    summary: str


@router.post("/get_itinerary", response_model=GetItineraryResponse)
async def get_itinerary(body: GetItineraryRequest):
    """
    ElevenLabs tool config (dashboard):
      Name: get_itinerary
      Description: Plans a real, complete trip itinerary (flights,
        hotels, places, weather) and returns a short spoken summary.
        Use search_destinations instead for general questions that
        don't require a full plan.
      Method: POST
      Body params (LLM-filled):
        origin (string, required)
        destination (string, required)
        travel_dates (string, required) -- ask the caller for an
          explicit date if they're vague; e.g. "next week" is not a
          usable date for the underlying planner
        travelers (string, optional, default "1 adult")
        budget (string, optional, default "flexible")
    """
    query_text = (
        f"Plan a trip from {body.origin} to {body.destination} "
        f"for {body.travelers}, budget {body.budget}, departing {body.travel_dates}"
    )
    summary = await _get_itinerary(query_text)
    return GetItineraryResponse(summary=summary)
