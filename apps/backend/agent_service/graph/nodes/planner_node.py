from graph.state import TripPlanState
from llm.llm_client import get_llm
from llm.prompts import PLANNER_SYSTEM_PROMPT
from shared.schemas import TripRequest


def planner_node(state: TripPlanState) -> TripPlanState:
    """
    Uses the LLM to extract structured trip information.
    """

    llm = get_llm().with_structured_output(TripRequest)

    response = llm.invoke(
        [
            ("system", PLANNER_SYSTEM_PROMPT),
            ("human", state["user_query"]),
        ]
    )

    state["parsed_trip"] = response.model_dump()

    return state