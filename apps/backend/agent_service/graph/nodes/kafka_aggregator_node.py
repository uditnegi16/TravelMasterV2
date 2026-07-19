from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy

from graph.progress_utils import emit_progress
from graph.state import TripPlanState
from kafka_bus.consumer import collect_agent_results
from kafka_bus.producer import publish_agent_result
from kafka_bus.topics import (
    FLIGHTS_TOPIC,
    HOTELS_TOPIC,
    PLACES_TOPIC,
    WEATHER_TOPIC,
)
from shared.logging_config import logger
from tools.flight_tool import flight_tool
from tools.hotel_tool import hotel_tool
from tools.places_tool import places_tool
from tools.weather_tool import weather_tool
import json
# Which state fields each agent is responsible for publishing. Same idea
# as the result_key_by_tool map in parallel_tools_node.py, kept explicit
# per-agent here so one agent's deepcopy-polluted fields can never leak
# into another agent's Kafka payload.
_AGENTS = {
    "flight": (
        flight_tool,
        FLIGHTS_TOPIC,
        ("flights", "recommended_flight", "flight_categories"),
    ),
    "hotel": (
        hotel_tool,
        HOTELS_TOPIC,
        (
            "hotel_budget",
            "itinerary",
            "multi_itineraries",
            "recommended_profile",
            "recommended_itinerary",
        ),
    ),
    "places": (places_tool, PLACES_TOPIC, ("places",)),
    "weather": (weather_tool, WEATHER_TOPIC, ("weather",)),
}


def _run_and_publish(name: str, tool, topic: str, fields: tuple, state: TripPlanState, session_id: str):
    """Runs one agent against its own deepcopy of state (same isolation
    pattern as parallel_tools_node.py) and publishes only the fields that
    agent owns to its topic - never the whole state."""
    local_state = deepcopy(state)
    result = tool(local_state)

    payload = {field: result[field] for field in fields if field in result}
    payload["errors"] = result.get("errors", [])

    for field, value in payload.items():
        logger.info(
            f"{name}.{field} size = {len(json.dumps(value).encode('utf-8'))} bytes"
        )

    logger.info(
        f"{name} payload size = {len(json.dumps(payload).encode('utf-8'))} bytes"
)
    publish_agent_result(topic, session_id, payload)

    return name, payload


def kafka_aggregator_node(state: TripPlanState) -> TripPlanState:
    """
    Async message-bus path (enabled via AGENT_BUS=kafka), replacing the
    direct/sequential flight_tool -> hotel_tool -> parallel_tools chain.

    Each planning agent still runs concurrently in this process, but
    instead of returning its result straight back into shared state, it
    PUBLISHES to its own Kafka topic keyed by session_id. A short-lived
    consumer group then reads back from all four topics and merges the
    results into state. This decouples agent execution from aggregation:
    every agent's output is independently replayable/inspectable on its
    topic, and a slow or failing agent degrades to a partial result
    instead of blocking the others in-process.
    """
    print("!!! KAFKA_AGGREGATOR_NODE ENTERED !!!")
    session_id = state.get("session_id") or "unknown-session"

    emit_progress(state, "tools", "started", "Fetching travel data via Kafka bus...")

    try:
        with ThreadPoolExecutor(max_workers=len(_AGENTS)) as executor:
            futures = [
                executor.submit(_run_and_publish, name, tool, topic, fields, state, session_id)
                for name, (tool, topic, fields) in _AGENTS.items()
            ]

            for future in futures:
                try:
                    future.result()
                except Exception as e:
                    logger.error(f"Kafka agent publish failed | {e}")
                    state["errors"].append(f"agent-publish: {e}")

        collected = collect_agent_results(session_id)

        for key, value in collected.items():
            if key == "session_id":
                continue

            if isinstance(value, dict):
                for inner_key, inner_value in value.items():
                    if inner_key == "errors":
                        if inner_value:
                            state["errors"].extend(inner_value)
                    else:
                        state[inner_key] = inner_value

        emit_progress(state, "tools", "completed")

        return state

    except Exception:
        emit_progress(state, "tools", "failed")
        raise
