import time

from graph.state import TripPlanState
from services.places_service import search_places
from shared.logging_config import logger


def places_tool(state: TripPlanState) -> TripPlanState:
    start = time.perf_counter()

    trip = state["parsed_trip"]
    city = trip["destination_city"]

    try:
        state["places"] = search_places(city)

    except Exception as e:
        logger.error(f"Places Tool Failed | {e}")

        state["places"] = []

        state["errors"].append("Places service unavailable.")

    logger.info(
        f"Places Tool | {time.perf_counter() - start:.2f}s"
    )

    return state