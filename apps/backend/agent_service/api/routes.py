from fastapi import APIRouter, HTTPException, Request

from core.redis_client import redis_client
from api.schemas import TripRequest, TripResponse
from graph.build_graph import build_graph
from services.response_builder import build_response
router = APIRouter()

graph = build_graph()


@router.post("/plan-trip")
def plan_trip(request: Request, body: TripRequest):
    client_ip = request.client.host

    rate_key = f"travelguru:v2:rate:{client_ip}"

    current = redis_client.incr(rate_key)

    if current == 1:
        redis_client.expire(rate_key, 60)

    if current > 5:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again in a minute.",
        )
    state = {
        "user_query": body.query,
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