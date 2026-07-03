from graph.state import TripPlanState
from services.places_service import search_places


def places_tool(state: TripPlanState):

    city = state["flights"][0]["destination_city"]

    state["places"] = search_places(city)

    return state