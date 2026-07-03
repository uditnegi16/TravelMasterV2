from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy

from graph.state import TripPlanState
from tools.flight_tool import flight_tool
from tools.hotel_tool import hotel_tool
from tools.places_tool import places_tool
from tools.weather_tool import weather_tool


def parallel_tools_node(state: TripPlanState) -> TripPlanState:
    """
    Executes all travel tools concurrently and safely merges results.
    """

    def run(tool):
        local_state = deepcopy(state)
        return tool(local_state)

    with ThreadPoolExecutor(max_workers=4) as executor:

        futures = {
            "flight": executor.submit(run, flight_tool),
            "hotel": executor.submit(run, hotel_tool),
            "places": executor.submit(run, places_tool),
            "weather": executor.submit(run, weather_tool),
        }

        for name, future in futures.items():
            try:
                result = future.result()

                if "flights" in result:
                    state["flights"] = result["flights"]

                if "hotels" in result:
                    state["hotels"] = result["hotels"]

                if "places" in result:
                    state["places"] = result["places"]

                if "weather" in result:
                    state["weather"] = result["weather"]

            except Exception as e:
                state["errors"].append(f"{name}: {e}")

    return state