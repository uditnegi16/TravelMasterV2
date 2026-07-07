from __future__ import annotations

from copy import deepcopy

from services.itinerary_profiles import (
    ITINERARY_PROFILES,
)
from services.trip_optimizer import build_itinerary


def generate_itineraries(
    budget: str,
    recommended_flight: dict | None,
    hotels: list[dict],
) -> list[dict]:
    """
    Generates multiple itinerary variants from the
    same search results.

    No external APIs are called here.
    """

    itineraries: list[dict] = []

    for profile in ITINERARY_PROFILES:

        profile_hotels = deepcopy(hotels)

        if profile_hotels:

            ratio = (
                profile.hotel_budget_ratio
                / 0.55
            )

            for hotel in profile_hotels:

                hotel[
                    "estimated_price_per_night"
                ] = round(
                    hotel["estimated_price_per_night"]
                    * ratio,
                    2,
                )

                hotel[
                    "estimated_total_cost"
                ] = round(
                    hotel["estimated_total_cost"]
                    * ratio,
                    2,
                )

        itinerary = build_itinerary(
            budget=budget,
            recommended_flight=recommended_flight,
            hotels=profile_hotels,
        )

        itineraries.append(
            {
                "profile": profile.name,
                "itinerary": itinerary.model_dump(),
            }
        )

    return itineraries