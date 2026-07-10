from graph.state import TripPlanState
from llm.llm_client import get_llm
from llm.prompts import PLANNER_SYSTEM_PROMPT
from shared.schemas import TripRequest
from graph.progress_utils import emit_progress
from datetime import date
def planner_node(state: TripPlanState) -> TripPlanState:
    """
    Uses the LLM to extract structured trip information.

    This node only ever runs for NEW_TRIP turns now - MODIFY_TRIP is
    routed to trip_modifier_node instead (see build_graph.py), and
    FOLLOW_UP/GENERAL_CHAT are answered directly in chat_routes.py
    without entering the graph at all. So this stays a plain, focused
    "extract a TripRequest from this message" prompt.
    """

    emit_progress(
        state,
        "planner",
        "started",
        "Understanding trip request...",
    )

    try:
        llm = get_llm().with_structured_output(
            TripRequest,
        )

        system_prompt = PLANNER_SYSTEM_PROMPT.format(
        current_date=date.today().isoformat(),
        )

        response = llm.invoke(
            [
                ("system", system_prompt),
                ("human", state["user_query"]),
            ]
        )
        parsed_trip = response.model_dump()

        state["parsed_trip"] = parsed_trip
        state["flight_strategy"] = parsed_trip["flight_strategy"]

        emit_progress(
            state,
            "planner",
            "completed",
        )

        return state

    except Exception:
        emit_progress(
            state,
            "planner",
            "failed",
        )
        raise