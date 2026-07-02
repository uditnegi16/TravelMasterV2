from graph.state import TripPlanState


def tool_router_node(state: TripPlanState) -> TripPlanState:
    """
    Determines which travel tools should be executed.
    """

    state["tools_to_call"] = [
        "flight",
        "hotel",
        "places",
        "weather",
    ]

    return state