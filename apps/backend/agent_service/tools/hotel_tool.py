from graph.state import TripPlanState
from services.hotel_service import search_hotels


def hotel_tool(state: TripPlanState) -> TripPlanState:
    city = state["flights"][0]["destination_city"]

    state["hotels"] = search_hotels(city)

    return state