from graph.state import TripPlanState
from services.weather_service import get_weather


def weather_tool(state: TripPlanState):

    city = state["flights"][0]["destination_city"]

    state["weather"] = get_weather(city)

    return state