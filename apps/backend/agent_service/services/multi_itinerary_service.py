from __future__ import annotations

from copy import deepcopy
from services.hotel_optimizer import rank_hotels_for_profile
from services.itinerary_profiles import (
    ITINERARY_PROFILES,
)
from services.trip_optimizer import build_itinerary
from services.route_optimizer import (
    rank_routes_for_profile,
)
def generate_itineraries(
    budget: str,
    flights: list[dict],
    hotels: list[dict],
) -> list[dict]:
    """
    Generates multiple itinerary variants from the
    same search results.

    No external APIs are called here.
    """

    itineraries: list[dict] = []

    for profile in ITINERARY_PROFILES:
        profile_flights = rank_routes_for_profile(
            deepcopy(flights),
            profile.name,
        )
        profile_hotels = deepcopy(hotels)

        selected_flight = (
            profile_flights[0]
            if profile_flights
            else None
        )

        profile_hotels = rank_hotels_for_profile(
            profile_hotels,
            profile.name,
        )

        itinerary = build_itinerary(
            budget=budget,
            recommended_flight=selected_flight,
            hotels=profile_hotels,
        )

        itineraries.append(
            {
                "profile": profile.name,
                "flight_score": (
                    selected_flight.get(
                        "profile_route_score",
                        0,
                    )
                    if selected_flight
                    else 0
                ),
                "hotel_score": (
                    profile_hotels[0].get(
                        "profile_score",
                        0,
                    )
                    if profile_hotels
                    else 0
                ),
                "itinerary": itinerary.model_dump(),
            }
        )

    _attach_tradeoffs(itineraries)

    return itineraries


def _attach_tradeoffs(itineraries: list[dict]) -> None:
    """
    Objective 8.4: comparative "tradeoffs" copy for each package,
    e.g. "1 stop, but ₹1,200 cheaper than Luxury".

    Runs after all profiles are built (needs all three to compare
    against). Only ever compares real fields already present on the
    itinerary (price, stops, hotel_class) - no invented commentary.
    """

    for index, entry in enumerate(itineraries):

        others = [
            other
            for other_index, other in enumerate(itineraries)
            if other_index != index
        ]

        tradeoffs: list[str] = []

        flight = entry["itinerary"].get("flight")
        hotels = entry["itinerary"].get("hotels") or []
        hotel = hotels[0] if hotels else None

        for other in others:
            other_flight = other["itinerary"].get("flight")

            if not flight or not other_flight:
                continue

            price_diff = flight["price"] - other_flight["price"]

            if flight["stops"] == other_flight["stops"]:
                continue

            if flight["stops"] < other_flight["stops"] and price_diff > 0:
                tradeoffs.append(
                    f"Fewer stops than {other['profile']}, "
                    f"but ₹{price_diff:,.0f} more for the flight"
                )
            elif flight["stops"] > other_flight["stops"] and price_diff < 0:
                tradeoffs.append(
                    f"₹{abs(price_diff):,.0f} cheaper flight than {other['profile']}, "
                    f"but {flight['stops']} stop(s) vs {other_flight['stops']}"
                )

        for other in others:
            other_hotels = other["itinerary"].get("hotels") or []
            other_hotel = other_hotels[0] if other_hotels else None

            if not hotel or not other_hotel:
                continue

            if hotel["hotel_class"] == other_hotel["hotel_class"]:
                continue

            price_diff = (
                hotel["estimated_price_per_night"]
                - other_hotel["estimated_price_per_night"]
            )

            hotel_class_label = hotel["hotel_class"].replace("_", " ")

            if price_diff > 0:
                tradeoffs.append(
                    f"{hotel_class_label.title()} hotel, "
                    f"₹{price_diff:,.0f}/night more than {other['profile']}"
                )
            elif price_diff < 0:
                tradeoffs.append(
                    f"₹{abs(price_diff):,.0f}/night cheaper hotel than {other['profile']}, "
                    f"still {hotel_class_label} class"
                )

        entry["tradeoffs"] = tradeoffs