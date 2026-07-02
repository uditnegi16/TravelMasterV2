from typing import TypedDict


class TripPlanState(TypedDict):
    """
    Shared state passed between all LangGraph nodes.
    Each node reads from and updates this state.
    """

    # Original user request
    user_query: str

    # Planner output
    parsed_trip: dict

    # Tool outputs
    flights: list
    hotels: list
    places: list
    weather: dict

    # Composer output
    tools_to_call: list[str]

    final_response: str
    errors: list[str]