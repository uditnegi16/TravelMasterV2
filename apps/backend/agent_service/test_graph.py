from dotenv import load_dotenv

load_dotenv()

from graph.build_graph import build_graph

graph = build_graph()

state = {
    "user_query": (
        "Plan a trip from DEL to NRT departing on "
        "2026-10-10 for 5 days with one traveler and a budget of ₹200000."
    ),
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

print(result["final_response"])