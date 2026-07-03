from langgraph.graph import START, END, StateGraph

from graph.state import TripPlanState
from graph.nodes.planner_node import planner_node
from graph.nodes.tool_router_node import tool_router_node
from graph.nodes.location_resolver_node import location_resolver_node
from tools.flight_tool import flight_tool
from tools.hotel_tool import hotel_tool
from tools.places_tool import places_tool
from tools.weather_tool import weather_tool
from graph.nodes.composer_node import composer_node
def build_graph():
    """
    Builds and compiles the LangGraph workflow.
    """

    graph_builder = StateGraph(TripPlanState)

    # --------------------
    # Register Nodes
    # --------------------
    graph_builder.add_node("planner", planner_node)
    graph_builder.add_node("location_resolver", location_resolver_node)
    graph_builder.add_node("tool_router", tool_router_node)

    graph_builder.add_node("flight_tool", flight_tool)
    graph_builder.add_node("hotel_tool", hotel_tool)
    graph_builder.add_node("places_tool", places_tool)
    graph_builder.add_node("weather_tool", weather_tool)

    graph_builder.add_node("composer", composer_node)

    # --------------------
    # Workflow
    # --------------------
    graph_builder.add_edge(START, "planner")

    graph_builder.add_edge("planner", "location_resolver")

    graph_builder.add_edge("location_resolver", "tool_router")

    graph_builder.add_edge("tool_router", "flight_tool")

    graph_builder.add_edge("flight_tool", "hotel_tool")

    graph_builder.add_edge("hotel_tool", "places_tool")

    graph_builder.add_edge("places_tool", "weather_tool")

    graph_builder.add_edge("weather_tool", "composer")

    graph_builder.add_edge("composer", END)

    return graph_builder.compile()