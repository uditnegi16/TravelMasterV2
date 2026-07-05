from graph.state import TripPlanState
from services.flight_service import search_flights
from shared.cache import get_cache, set_cache
import time
from graph.progress_utils import emit_progress
from shared.logging_config import logger

def flight_tool(state: TripPlanState) -> TripPlanState:
    emit_progress(
        state,
        "flight",
        "started",
        "Searching flights...",
    )

    start = time.perf_counter()

    trip = state["parsed_trip"]

    cache_key = (
        f"travelguru:v2:flight:"
        f"{trip['origin']}:"
        f"{trip['destination']}:"
        f"{trip['start_date']}"
    )

    flights = get_cache(cache_key)

    if flights is None:
        try:
            flights = search_flights(
                origin=trip["origin"],
                destination=trip["destination"],
                departure_date=trip["start_date"],
                adults=trip["travelers"],
            )

            set_cache(cache_key, flights)

            state["flights"] = flights

        except Exception as e:
            logger.error(f"Flight Tool Failed | {e}")

            state["flights"] = []

            state["errors"].append("Flight service unavailable.")

            emit_progress(state, "flight", "failed")

            return state
    else:
        state["flights"] = flights

    logger.info(
        f"Flight Tool | {time.perf_counter() - start:.2f}s"
    )

    emit_progress(state, "flight", "completed")

    return state