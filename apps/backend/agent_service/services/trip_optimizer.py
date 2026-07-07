from __future__ import annotations

import re

from shared.schemas import TripItinerary


def build_itinerary(
    budget: str,
    recommended_flight: dict | None,
    hotels: list[dict],
) -> TripItinerary:

    budget_value = _parse_budget(budget)

    flight_cost = 0.0

    if recommended_flight:
        flight_cost = recommended_flight["price"]

    hotel_cost = 0.0

    if hotels:
        hotel_cost = hotels[0]["estimated_total_cost"]

    layover_cost = 0.0

    if (
        recommended_flight
        and recommended_flight["requires_layover_hotel"]
    ):
        layover_cost = recommended_flight[
            "estimated_extra_cost"
        ]

    total = (
        flight_cost
        + hotel_cost
        + layover_cost
    )

    remaining = max(
        0.0,
        budget_value - total,
    )

    return TripItinerary(
        flight=recommended_flight,
        hotels=hotels,
        total_flight_cost=flight_cost,
        total_hotel_cost=hotel_cost,
        layover_cost=layover_cost,
        total_trip_cost=total,
        remaining_budget=remaining,
        within_budget=total <= budget_value,
    )


def _parse_budget(budget: str) -> float:

    cleaned = re.sub(
        r"[^\d.]",
        "",
        budget,
    )

    if not cleaned:
        return 0

    return float(cleaned)