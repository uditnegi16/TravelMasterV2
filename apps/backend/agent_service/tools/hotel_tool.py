import time

from graph.state import TripPlanState
from services.hotel_service import search_hotels
from services.hotel_optimizer import optimize_hotels
from services.trip_optimizer import build_itinerary
from services.multi_itinerary_service import generate_itineraries
from services.itinerary_ranker import rank_itineraries
import re
from shared.cache import get_cache, set_cache
from shared.logging_config import logger
from graph.progress_utils import emit_progress

def hotel_tool(state: TripPlanState) -> TripPlanState:
    emit_progress(
        state,
        "hotel",
        "started",
        "Searching hotels...",
    )

    start = time.perf_counter()
    trip = state["parsed_trip"]
    recommended_flight = state.get(
    "recommended_flight"
    )

    budget_text = trip.get(
        "budget",
        "",
    )

    budget = 0.0

    if budget_text:
        cleaned = re.sub(
            r"[^\d.]",
            "",
            budget_text,
        )

        if cleaned:
            budget = float(cleaned)

    flight_cost = 0.0

    if recommended_flight:
        flight_cost = recommended_flight["price"]

    remaining_budget = max(
        0.0,
        budget - flight_cost,
    )

    hotel_budget = remaining_budget * 0.55

    state["hotel_budget"] = hotel_budget
    
    
    city = trip["destination_city"]

    cache_key = (
        f"travelguru:v2:hotel:"
        f"{city}:"
        f"{trip['start_date']}:"
        f"{trip['travelers']}"
    )

    try:
        hotels = get_cache(cache_key)

        if hotels is None:
            hotels = search_hotels(
                city,
            )

            hotels = optimize_hotels(
                hotels=hotels,
                hotel_budget=hotel_budget,
                duration_days=trip["duration_days"],
            )
            set_cache(cache_key, hotels)

        state["hotels"] = hotels

        recommended_flight = state.get(
            "recommended_flight"
        )

        itinerary = build_itinerary(
            budget=trip["budget"],
            recommended_flight=recommended_flight,
            hotels=hotels,
        )

        state["itinerary"] = itinerary.model_dump()

        multi_itineraries = generate_itineraries(
            budget=trip["budget"],
            recommended_flight=recommended_flight,
            hotels=hotels,
        )

        ranked_itineraries = rank_itineraries(
            multi_itineraries,
        )

        state["multi_itineraries"] = ranked_itineraries

        if ranked_itineraries:
            state["recommended_profile"] = (
                ranked_itineraries[0]["profile"]
            )
            state["recommended_itinerary"] = (
                ranked_itineraries[0]["itinerary"]
            )
    
        state["itinerary"] = itinerary.model_dump()
        logger.info(
            f"Remaining Budget: ₹{remaining_budget:.2f}"
        )

        logger.info(
            f"Hotel Budget: ₹{hotel_budget:.2f}"
        )

        emit_progress(state, "hotel", "completed")

    except Exception:
        logger.exception("Hotel Tool Failed")

        state["hotels"] = []

        state["itinerary"] = {}

        state["multi_itineraries"] = []

        state["recommended_itinerary"] = {}

        state["errors"].append(
            "Hotel information is temporarily unavailable."
        )

        emit_progress(
            state,
            "hotel",
            "failed",
        )

    logger.info(
        f"Hotel Tool | {time.perf_counter() - start:.2f}s"
    )

    return state