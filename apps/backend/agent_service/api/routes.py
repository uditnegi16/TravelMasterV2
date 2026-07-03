from fastapi import APIRouter

from api.schemas import TripRequest, TripResponse
from graph.build_graph import build_graph
from services.response_builder import build_response
router = APIRouter()

graph = build_graph()


@router.post("/plan-trip")
def plan_trip(request: TripRequest):

    state = {
        "user_query": request.query,
        "parsed_trip": {},
        "tools_to_call": [],
        "flights": [],
        "hotels": [],
        "places": [],
        "weather": {},
        "final_response": "",
        "errors": [],
    }

    result = graph.invoke(state)

    return build_response(result)