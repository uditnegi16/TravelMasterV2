from pydantic import BaseModel

from models.trip_response import TripResponseModel


class TripRequest(BaseModel):
    query: str
    session_id: str


class TripResponse(BaseModel):
    trip: TripResponseModel


class GeneratePdfRequest(BaseModel):
    # Objective 5.4 — Async PDF Generation.
    # `trip` is intentionally a plain dict, not TripResponseModel,
    # because response_builder.build_response() returns a superset
    # shape (summary/recommended/flights/hotels/places/weather/
    # parsed_trip) that doesn't match TripResponseModel's fields
    # 1:1 (e.g. "recommended" vs. "flight"/"hotel", plus parsed_trip
    # isn't in TripResponseModel at all). Keeping it a dict avoids
    # forcing a schema reconciliation that's out of scope for 5.4 —
    # revisit if/when TripResponseModel and build_response() get
    # unified.
    session_id: str
    trip: dict