import os

# Comma-separated list of broker addresses, e.g. "localhost:9092" locally
# or a cluster's bootstrap endpoint in staging/prod.
KAFKA_BOOTSTRAP_SERVERS = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
).split(",")

# AGENT_BUS toggles the graph between the original direct/sequential tool
# calls ("direct", default) and the Kafka-mediated bus ("kafka"). Kept
# behind a flag rather than a hard swap so local dev / CI never needs a
# broker running unless someone opts in.
KAFKA_ENABLED = os.getenv("AGENT_BUS", "direct").lower() == "kafka"

# How long the aggregator waits for all four agent topics to report back
# for a given session_id before giving up and returning whatever arrived.
AGGREGATOR_TIMEOUT_SECONDS = float(os.getenv("KAFKA_AGGREGATOR_TIMEOUT", "15"))

# Consumer group used by the health/lag-monitoring endpoint. Separate from
# the per-session aggregator groups (see kafka_bus.topics.CONSUMER_GROUP)
# so monitoring reads never interfere with request-serving consumers.
MONITOR_GROUP_ID = os.getenv("KAFKA_MONITOR_GROUP", "travelguru-monitor")
