print("bg: StateGraph")
from langgraph.graph import START, END, StateGraph

print("bg: state")
from graph.state import TripPlanState

print("bg: planner")
from graph.nodes.planner_node import planner_node

print("bg: trip_modifier")
from graph.nodes.trip_modifier_node import trip_modifier_node

print("bg: tool_router")
from graph.nodes.tool_router_node import tool_router_node

print("bg: location_resolver")
from graph.nodes.location_resolver_node import location_resolver_node

print("bg: rag")
from graph.nodes.rag_retriever import rag_retriever_node

print("bg: parallel_tools")
from graph.nodes.parallel_tools_node import parallel_tools_node

print("bg: flight_tool")
from tools.flight_tool import flight_tool

print("bg: hotel_tool")
from tools.hotel_tool import hotel_tool

print("bg: composer")
from graph.nodes.composer_node import composer_node

print("bg: kafka_bus config")
from kafka_bus.config import KAFKA_ENABLED

print("bg: kafka_aggregator")
from graph.nodes.kafka_aggregator_node import kafka_aggregator_node

print("bg: imports done")


def _route_entry(state: TripPlanState) -> str:
    """NEW_TRIP builds a trip from scratch (planner). MODIFY_TRIP
    starts from the existing trip and applies a targeted update
    (trip_modifier) instead of re-extracting everything from just the
    latest message. FOLLOW_UP/GENERAL_CHAT never reach graph.invoke()
    at all - chat_routes.py answers those directly via qa_node.py."""

    if state.get("conversation_type") == "MODIFY_TRIP":
        return "trip_modifier"
    return "planner"



DATE_CLARIFICATION_MESSAGE = (
    "I need a clearer travel date before I can search flights. "
    "Please give a specific date or date range with the year - "
    "for example \"12 April 2027\" or \"2027-04-12 to 2027-04-17\". "
    "A month on its own (or a date that has already passed) is "
    "ambiguous, and the airline search rejects it."
)


def _needs_date_clarification(state):
    """Stop before the tool pipeline if we could not resolve a real
    future travel date. Guessing a year silently produced wrong trips
    and a 422 from the flight API."""
    trip = state.get("parsed_trip") or {}
    if trip.get("needs_date_clarification"):
        state["final_response"] = DATE_CLARIFICATION_MESSAGE
        state["needs_date_clarification"] = True
        return "ask_for_date"
    return "continue"


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

    graph_builder.add_node("kafka_aggregator", kafka_aggregator_node)

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

    # Ambiguous date -> stop and ask, instead of planning a trip
    # around a date the user never gave.
    graph_builder.add_conditional_edges(
        "location_resolver",
        _needs_date_clarification,
        {"continue": "rag_retriever", "ask_for_date": END},
    )

    graph_builder.add_edge("rag_retriever", "tool_router")

    print(f"!!! build_graph: KAFKA_ENABLED = {KAFKA_ENABLED} !!!")
    if KAFKA_ENABLED:
        # Async message-bus path: each agent publishes its own result to
        # its own Kafka topic and the aggregator reads them back merged.
        # See graph/nodes/kafka_aggregator_node.py.
        graph_builder.add_edge("tool_router", "kafka_aggregator")
        graph_builder.add_edge("kafka_aggregator", "composer")
    else:
        graph_builder.add_edge("tool_router", "flight_tool")

        graph_builder.add_edge("flight_tool", "hotel_tool")

        graph_builder.add_edge("hotel_tool", "parallel_tools")

        graph_builder.add_edge("parallel_tools", "composer")

    graph_builder.add_edge("composer", END)

    return graph_builder.compile()