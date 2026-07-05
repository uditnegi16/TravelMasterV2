from langgraph.graph import START, END, StateGraph

from graph.state import TripPlanState
from graph.nodes.planner_node import planner_node
from graph.nodes.tool_router_node import tool_router_node
from graph.nodes.location_resolver_node import location_resolver_node
from graph.nodes.rag_retriever import rag_retriever_node
from graph.nodes.parallel_tools_node import parallel_tools_node
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
    graph_builder.add_node("rag_retriever", rag_retriever_node)
    graph_builder.add_node("tool_router", tool_router_node)

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
    graph_builder.add_edge(START, "planner")

    graph_builder.add_edge("planner", "location_resolver")

    graph_builder.add_edge("location_resolver", "rag_retriever")

    graph_builder.add_edge("rag_retriever", "tool_router")
    graph_builder.add_edge("tool_router", "parallel_tools")

    graph_builder.add_edge("parallel_tools", "composer")

    graph_builder.add_edge("composer", END)

    return graph_builder.compile()