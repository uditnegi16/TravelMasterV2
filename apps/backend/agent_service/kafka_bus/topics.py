"""
Topic names for the async agent message bus.

Each planning agent (flight/hotel/places/weather) publishes its result to
its own topic instead of returning it directly to the caller. A
short-lived consumer group in kafka_bus.consumer reads back from all four
topics, keyed by session_id, and merges the results into the shared
LangGraph state - decoupling agent execution from aggregation and making
every agent's output independently replayable and inspectable.
"""

FLIGHTS_TOPIC = "travelguru.agents.flights"
HOTELS_TOPIC = "travelguru.agents.hotels"
PLACES_TOPIC = "travelguru.agents.places"
WEATHER_TOPIC = "travelguru.agents.weather"

ALL_AGENT_TOPICS = [
    FLIGHTS_TOPIC,
    HOTELS_TOPIC,
    PLACES_TOPIC,
    WEATHER_TOPIC,
]

# Base name for the per-session consumer groups spun up by the aggregator.
# The actual group_id is f"{CONSUMER_GROUP}-{session_id}" so that replaying
# one session's events never advances another session's offsets.
CONSUMER_GROUP = "travelguru-aggregator"

DEFAULT_PARTITIONS_PER_TOPIC = 4
DEFAULT_REPLICATION_FACTOR = 1
