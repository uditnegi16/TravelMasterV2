from langgraph.graph import START, END, StateGraph

from graph.state import TripPlanState
from graph.nodes.planner_node import planner_node
from graph.nodes.trip_modifier_node import trip_modifier_node
from graph.nodes.tool_router_node import tool_router_node
from graph.nodes.location_resolver_node import location_resolver_node
from graph.nodes.rag_retriever import rag_retriever_node
from graph.nodes.parallel_tools_node import parallel_tools_node
from tools.flight_tool import flight_tool
from tools.hotel_tool import hotel_tool
from graph.nodes.composer_node import composer_node


def _route_entry(state: TripPlanState) -> str:
    """NEW_TRIP builds a trip from scratch (planner). MODIFY_TRIP
    starts from the existing trip and applies a targeted update
    (trip_modifier) instead of re-extracting everything from just the
    latest message. FOLLOW_UP/GENERAL_CHAT never reach graph.invoke()
    at all - chat_routes.py answers those directly via qa_node.py."""

    if state.get("conversation_type") == "MODIFY_TRIP":
        return "trip_modifier"
    return "planner"


def build_graph():
    """
    Builds and compiles the LangGraph workflow.
    """

    graph_builder = StateGraph(TripPlanState)

    # --------------------
    # Register Nodes
    # --------------------
    graph_builder.add_node("planner", planner_node)
    graph_builder.add_node("trip_modifier", trip_modifier_node)
    graph_builder.add_node("location_resolver", location_resolver_node)
    graph_builder.add_node("rag_retriever", rag_retriever_node)
    graph_builder.add_node("tool_router", tool_router_node)
    graph_builder.add_node("flight_tool", flight_tool)
    graph_builder.add_node("hotel_tool", hotel_tool)

    # Phase 5 fix: this was previously 4 separate sequential nodes
    # (flight_tool -> hotel_tool -> places_tool -> weather_tool).
    # parallel_tools_node.py already existed with a correct
    # ThreadPoolExecutor implementation but was never wired in, so
    # tools were still running one after another. Switching to it now.
    graph_builder.add_node("parallel_tools", parallel_tools_node)

    graph_builder.add_node("composer", composer_node)

    # --------------------
    # Workflow
    # --------------------
    graph_builder.add_conditional_edges(
        START,
        _route_entry,
        {"planner": "planner", "trip_modifier": "trip_modifier"},
    )

    graph_builder.add_edge("planner", "location_resolver")
    graph_builder.add_edge("trip_modifier", "location_resolver")

    graph_builder.add_edge("location_resolver", "rag_retriever")

    graph_builder.add_edge("rag_retriever", "tool_router")

    graph_builder.add_edge("tool_router", "flight_tool")

    graph_builder.add_edge("flight_tool", "hotel_tool")

    graph_builder.add_edge("hotel_tool", "parallel_tools")

    graph_builder.add_edge("parallel_tools", "composer")

    graph_builder.add_edge("composer", END)

    return graph_builder.compile()