import time

from graph.state import TripPlanState
from services.weather_service import get_weather
from shared.logging_config import logger
from graph.progress_utils import emit_progress

def weather_tool(state: TripPlanState) -> TripPlanState:
    emit_progress(
        state,
        "weather",
        "started",
        "Checking weather...",
    )

    start = time.perf_counter()

    trip = state["parsed_trip"]
    city = trip["destination_city"]

    try:
        state["weather"] = get_weather(city)

        emit_progress(state, "weather", "completed")

    except Exception as e:
        logger.error(f"Weather Tool Failed | {e}")

        state["weather"] = {}

        state["errors"].append("Weather service unavailable.")

        emit_progress(state, "weather", "failed")

    logger.info(
        f"Weather Tool | {time.perf_counter() - start:.2f}s"
    )

    return state