import time

from graph.state import TripPlanState
from services.hotel_service import search_hotels
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
            hotels = search_hotels(city)
            set_cache(cache_key, hotels)

        state["hotels"] = hotels

        emit_progress(state, "hotel", "completed")

    except Exception as e:
        logger.error(f"Hotel Tool Failed | {e}")

        state["hotels"] = []
        state["errors"].append("Hotel service unavailable.")

        emit_progress(state, "hotel", "failed")

    logger.info(
        f"Hotel Tool | {time.perf_counter() - start:.2f}s"
    )

    return state