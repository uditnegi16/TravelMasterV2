from typing import Any
from shared.logging_config import logger

def build_response(state: dict[str, Any]) -> dict:
    logger.info("===== RESPONSE BUILDER STATE =====")
    logger.info(f"hotel_budget = {state.get('hotel_budget')}")
    logger.info(f"recommended_profile = {state.get('recommended_profile')}")
    logger.info(f"recommended_itinerary = {state.get('recommended_itinerary')}")
    logger.info(f"itinerary = {state.get('itinerary')}")
    logger.info(f"multi_itineraries = {state.get('multi_itineraries')}")
    logger.info(f"state keys = {list(state.keys())}")
    logger.info("==================================")
    flights = state.get("flights", [])
    hotels = state.get("hotels", [])
    places = state.get("places", [])

    recommended_flight = (
        state.get("recommended_flight")
        or (flights[0] if flights else None)
    )

    recommended_hotel = (
        hotels[0] if hotels else None
    )

    return {
        "success": True,
        "trip": {
            # ==========================
            # AI Summary
            # ==========================
            "summary": state.get("final_response", ""),

            # ==========================
            # Recommended Plan
            # ==========================
            "recommended": {
                "profile": state.get("recommended_profile"),
                "flight": recommended_flight,
                "hotel": recommended_hotel,
                "itinerary": state.get(
                    "recommended_itinerary"
                ),
            },

            # ==========================
            # Complete Planning Engine
            # ==========================
            "itinerary": state.get("itinerary"),

            "multi_itineraries": state.get(
                "multi_itineraries",
                [],
            ),

            "flight_categories": state.get(
                "flight_categories",
                {},
            ),

            "hotel_budget": state.get(
                "hotel_budget",
            ),

            # ==========================
            # Raw Search Results
            # ==========================
            "flights": flights,
            "hotels": hotels,
            "places": places,
            "weather": state.get("weather"),

            # ==========================
            # Planner Output
            # ==========================
            "parsed_trip": state.get(
                "parsed_trip",
            ),
            "conversation_type": state.get(
                "conversation_type",
            ),
        },

        "metadata": {
            "flight_count": len(flights),
            "hotel_count": len(hotels),
            "place_count": len(places),

            "recommended_profile": state.get(
                "recommended_profile"
            ),

            "itinerary_count": len(
                state.get(
                    "multi_itineraries",
                    [],
                )
            ),

            "flight_categories": list(
                state.get(
                    "flight_categories",
                    {},
                ).keys()
            ),
        },
    }