from typing import Callable, TypedDict, NotRequired



class TripPlanState(TypedDict):
    """
    Shared state passed between all LangGraph nodes.
    """

    # Original user request
    user_query: str

    # Planner output
    parsed_trip: dict

    # RAG Context
    retrieved_context: str

    # Tool outputs
    flights: list
    hotels: list
    places: list
    weather: dict

    # Composer output
    tools_to_call: list[str]

    final_response: str
    errors: list[str]

    # Phase 5
    progress_callback: NotRequired[Callable]
    flight_strategy: str
    flight_categories: NotRequired[dict]
    recommended_flight: NotRequired[dict]
    
    itinerary: NotRequired[dict]
    multi_itineraries: NotRequired[list]
    recommended_profile: NotRequired[str]
    recommended_itinerary: NotRequired[dict]
    hotel_budget: NotRequired[float]