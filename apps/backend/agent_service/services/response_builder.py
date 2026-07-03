from typing import Any


def build_response(state: dict[str, Any]) -> dict:
    flights = state.get("flights", [])
    hotels = state.get("hotels", [])
    places = state.get("places", [])

    return {
        "success": True,
        "trip": {
            "summary": state["final_response"],

            "recommended": {
                "flight": flights[0] if flights else None,
                "hotel": hotels[0] if hotels else None,
            },

            "flights": flights,
            "hotels": hotels,
            "places": places,
            "weather": state["weather"],
            "parsed_trip": state["parsed_trip"],
        },

        "metadata": {
            "flight_count": len(flights),
            "hotel_count": len(hotels),
            "place_count": len(places),
        },
    }