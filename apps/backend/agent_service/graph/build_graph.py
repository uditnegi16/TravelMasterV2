from langgraph.graph import START, END, StateGraph

from graph.state import TripPlanState
from graph.nodes.planner_node import planner_node
from graph.nodes.tool_router_node import tool_router_node

def build_graph():
    """
    Builds and compiles the LangGraph workflow.
    """

    graph_builder = StateGraph(TripPlanState)

    # Register nodes
    graph_builder.add_node("planner", planner_node)
    graph_builder.add_node("tool_router", tool_router_node)

    # Define execution flow
    graph_builder.add_edge(START, "planner")
    graph_builder.add_edge("planner", "tool_router")
    graph_builder.add_edge("tool_router", END)

    return graph_builder.compile()