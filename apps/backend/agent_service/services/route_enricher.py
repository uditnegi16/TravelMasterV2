from __future__ import annotations

from datetime import datetime
from typing import Any

LAYOVER_HOTEL_THRESHOLD_MINUTES = 12 * 60

OVERNIGHT_START_HOUR = 22
OVERNIGHT_END_HOUR = 6

DEFAULT_LAYOVER_HOTEL_COST = 3000


def enrich_flight(
    flight: dict[str, Any],
) -> dict[str, Any]:

    segments = flight.get("segments", [])

    layover_minutes = None
    overnight = False
    hotel_required = False

    if len(segments) > 1:

        arrival = _parse_datetime(
            segments[0]["arriving_at"]
        )

        departure = _parse_datetime(
            segments[1]["departing_at"]
        )

        layover_minutes = int(
            (departure - arrival).total_seconds() / 60
        )

        if layover_minutes >= LAYOVER_HOTEL_THRESHOLD_MINUTES:
            hotel_required = True

        if (
            arrival.hour >= OVERNIGHT_START_HOUR
            or departure.hour <= OVERNIGHT_END_HOUR
        ):
            overnight = True

    return {
        **flight,
        "layover_duration_minutes": layover_minutes,
        "overnight_layover": overnight,
        "requires_layover_hotel": hotel_required,
        "estimated_extra_cost": (
            DEFAULT_LAYOVER_HOTEL_COST
            if hotel_required
            else 0
        ),
    }


def _parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(
        value.replace("Z", "+00:00")
    )