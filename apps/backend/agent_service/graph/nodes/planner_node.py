from graph.state import TripPlanState


def planner_node(state: TripPlanState) -> TripPlanState:
    """
    First LangGraph node.

    For Phase 1, this simply stores the user's
    natural language query inside parsed_trip.

    Later this node will call the LLM to extract
    destination, dates, budget, travelers, etc.
    """

    user_query = state["user_query"]

    state["parsed_trip"] = {
        "query": user_query
    }

    return state