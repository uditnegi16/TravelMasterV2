from graph.state import TripPlanState
from graph.progress_utils import emit_progress

def tool_router_node(state: TripPlanState) -> TripPlanState:
    """
    Determines which travel tools should be executed.
    """

    emit_progress(
        state,
        "tool_router",
        "started",
        "Selecting travel tools...",
    )

    try:
        state["tools_to_call"] = [
            "flight",
            "hotel",
            "places",
            "weather",
        ]

        emit_progress(
            state,
            "tool_router",
            "completed",
        )

        return state

    except Exception:
        emit_progress(
            state,
            "tool_router",
            "failed",
        )
        raise