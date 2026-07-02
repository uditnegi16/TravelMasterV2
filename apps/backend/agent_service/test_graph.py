from graph.build_graph import build_graph

graph = build_graph()

state = {
    "user_query": "Plan a 5-day trip to Japan in October under ₹2 lakh.",
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

print(result["tools_to_call"])