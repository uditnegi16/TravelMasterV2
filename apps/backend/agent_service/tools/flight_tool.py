from graph.state import TripPlanState
from services.flight_service import search_flights
from services.route_optimizer import enrich_routes
from services.flight_mapper import map_flights
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

    flight_strategy = state.get(
        "flight_strategy",
        "prefer_direct",
    )

    logger.info(
        f"Flight Strategy: {flight_strategy}"
    )

    cache_key = (
        f"travelguru:v2:flight:"
        f"{trip['origin']}:"
        f"{trip['destination']}:"
        f"{trip['start_date']}"
    )

    cached = get_cache(cache_key)

    if cached is None:
        try:
            flights = search_flights(
            origin=trip["origin"],
            destination=trip["destination"],
            departure_date=trip["start_date"],
            adults=trip["travelers"],
            flight_strategy=flight_strategy,
        )
            logger.info(f"Flights returned from Duffel: {len(flights)}")
            if not flights:
                logger.warning(
                    "No flights returned."
                )

                state["errors"].append(
                    "No flights were found for the selected route."
                )

                state["flights"] = []

                emit_progress(
                    state,
                    "flight",
                    "completed",
                )

                return state

            optimized = enrich_routes(
                flights,
                budget=trip["budget"],
                strategy=flight_strategy,
            )
            logger.info(f"Optimized flights: {len(optimized['all'])}")

            logger.info(f"Recommended flight: {optimized['recommended']}")

            flights = map_flights(
                optimized["all"]
            )

            recommended_mapped = None

            if optimized["recommended"]:
                recommended_mapped = next(
                    (
                        flight
                        for flight in flights
                        if flight["id"] == optimized["recommended"]["id"]
                    ),
                    None,
                )
            cache_payload = {
                "all": flights,
                "categorized": optimized["categorized"],
                "recommended": recommended_mapped,
            }

            set_cache(
                cache_key,
                cache_payload,
            )

            state["flight_categories"] = optimized["categorized"]

            state["recommended_flight"] = recommended_mapped

            state["flights"] = flights

        except Exception as e:
            logger.exception("Flight Tool Failed")

            state["flights"] = []
            state["flight_categories"] = {}
            state["recommended_flight"] = None

            message = str(e)

            if "422" in message:
                state["errors"].append(
                    "Unable to find flights for the provided route."
                )
            else:
                state["errors"].append(
                    "Flight service is temporarily unavailable."
                )

            emit_progress(
                state,
                "flight",
                "failed",
            )

            return state
    else:
        state["flights"] = cached["all"]

        state["flight_categories"] = cached["categorized"]

        state["recommended_flight"] = cached["recommended"]

    logger.info(
        f"Flight Tool | {time.perf_counter() - start:.2f}s"
    )

    emit_progress(state, "flight", "completed")

    return state