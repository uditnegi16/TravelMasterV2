from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from graph.progress_utils import emit_progress
from graph.state import TripPlanState
from tools.places_tool import places_tool
from tools.weather_tool import weather_tool


def parallel_tools_node(state: TripPlanState) -> TripPlanState:
    """
    Executes all travel tools concurrently and safely merges results.
    """

    emit_progress(
        state,
        "tools",
        "started",
        "Fetching travel data...",
    )

    def run(tool):
        local_state = deepcopy(state)
        return tool(local_state)

    # Phase 5 fix: each tool runs on a full deepcopy of state, so every
    # result dict contains ALL of flights/hotels/places/weather, not just
    # the one that tool actually populated. The old merge loop checked
    # "if key in result" for every key on every future's result, so
    # whichever future was processed LAST in the loop silently overwrote
    # the other tools' real data with its own untouched (empty) values.
    # e.g. the "weather" future's result still has "flights": [] from its
    # deepcopy, and that was blowing away the real flight results.
    # Fix: only pull the one key each tool is actually responsible for.
    result_key_by_tool = {
        "places": "places",
        "weather": "weather",
    }

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:

            futures = {
                "places": executor.submit(run, places_tool),
                "weather": executor.submit(run, weather_tool),
            }

            for name, future in futures.items():
                try:
                    result = future.result()

                    key = result_key_by_tool[name]

                    if key in result:
                        state[key] = result[key]

                    # -------- Flight tool additions --------
                    if name == "flight":
                        for field in (
                            "recommended_flight",
                            "flight_categories",
                        ):
                            if field in result:
                                state[field] = result[field]

                    # -------- Hotel tool additions --------
                    if name == "hotel":
                        for field in (
                            "hotel_budget",
                            "itinerary",
                            "multi_itineraries",
                            "recommended_profile",
                            "recommended_itinerary",
                        ):
                            if field in result:
                                state[field] = result[field]

                    if result.get("errors"):
                        state["errors"].extend(result["errors"])

                except Exception as e:
                    state["errors"].append(f"{name}: {e}")

        emit_progress(
            state,
            "tools",
            "completed",
        )

        return state

    except Exception:
        emit_progress(
            state,
            "tools",
            "failed",
        )
        raise