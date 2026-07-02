from langgraph.graph import START, END, StateGraph

from graph.state import TripPlanState
from graph.nodes.planner_node import planner_node


def build_graph():
    """
    Builds and compiles the LangGraph workflow.
    """

    graph_builder = StateGraph(TripPlanState)

    # Register nodes
    graph_builder.add_node("planner", planner_node)

    # Define execution flow
    graph_builder.add_edge(START, "planner")
    graph_builder.add_edge("planner", END)

    return graph_builder.compile()