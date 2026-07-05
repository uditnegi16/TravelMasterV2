import time
from graph.progress_utils import emit_progress
from graph.state import TripPlanState
from services.places_service import search_places
from shared.logging_config import logger


def places_tool(state: TripPlanState) -> TripPlanState:
    emit_progress(
        state,
        "places",
        "started",
        "Finding attractions...",
    )

    start = time.perf_counter()

    trip = state["parsed_trip"]
    city = trip["destination_city"]

    try:
        state["places"] = search_places(city)

        emit_progress(state, "places", "completed")

    except Exception as e:
        logger.error(f"Places Tool Failed | {e}")

        state["places"] = []

        state["errors"].append("Places service unavailable.")

        emit_progress(state, "places", "failed")

    logger.info(
        f"Places Tool | {time.perf_counter() - start:.2f}s"
    )

    return state