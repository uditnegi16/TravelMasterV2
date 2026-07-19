# Kafka Agent Bus

## What this is

TravelGuru's planning graph runs four independent agents per trip request:
`flight_tool`, `hotel_tool`, `places_tool`, `weather_tool`. Originally
`flight_tool` and `hotel_tool` ran sequentially and `places`/`weather` ran
in a `ThreadPoolExecutor` (`graph/nodes/parallel_tools_node.py`), all
inside one process, all writing straight into shared LangGraph state.

This adds a second, Kafka-mediated path: each agent still runs
concurrently, but instead of handing its result back in-process, it
**publishes** to its own topic, and a consumer group reads the four
topics back and merges them into state. Toggle between the two with an
env var - nothing about the direct path changed or was removed.

```
AGENT_BUS=direct   (default)          AGENT_BUS=kafka
tool_router                            tool_router
  -> flight_tool                         -> kafka_aggregator_node
  -> hotel_tool                                |-- flight_tool  --> travelguru.agents.flights
  -> parallel_tools (places, weather)          |-- hotel_tool   --> travelguru.agents.hotels
       (ThreadPoolExecutor, in-process)        |-- places_tool  --> travelguru.agents.places
  -> composer                                  |-- weather_tool --> travelguru.agents.weather
                                                |
                                          collect_agent_results(session_id)
                                                |
                                          -> composer
```

## Why bother

The direct path is simpler and has no infra dependency, which is exactly
why it stays the default. The Kafka path buys three things a purely
in-process pipeline can't:

- **Replay** - every agent's output for every session sits on its topic
  (subject to broker retention), so a bad composer output can be
  debugged by replaying exactly what flight/hotel/places/weather
  produced, without re-calling any external API.
- **Decoupling** - a slow agent no longer blocks the others in the same
  thread pool; it just shows up late (or not at all) on its own topic,
  and the aggregator returns partial results after
  `KAFKA_AGGREGATOR_TIMEOUT` instead of hanging the whole request.
- **Observability** - `/admin/kafka/lag` gives per-partition consumer lag
  per topic, which is the concrete signal for "which agent is the
  bottleneck" (see Monitoring below).

## Files

| Path | Purpose |
|---|---|
| `kafka_bus/config.py` | Bootstrap servers, `AGENT_BUS` flag, timeouts |
| `kafka_bus/topics.py` | Topic name constants |
| `kafka_bus/producer.py` | Lazy singleton `KafkaProducer`, `publish_agent_result()` |
| `kafka_bus/consumer.py` | `collect_agent_results(session_id)` - the aggregator's read side |
| `kafka_bus/admin.py` | Cluster health + consumer-lag helpers |
| `graph/nodes/kafka_aggregator_node.py` | The LangGraph node wired in when `AGENT_BUS=kafka` |
| `api/kafka_monitor_routes.py` | `/admin/kafka/health`, `/admin/kafka/lag` |

## Running it locally

```bash
docker compose -f infra/kafka/docker-compose.yml up -d
# Kafka on localhost:9092, Kafka UI on http://localhost:8080

cd apps/backend/agent_service
export AGENT_BUS=kafka
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092
uvicorn main:app --reload
```

Hit `POST /plan-trip` as usual - the trip-planning behavior and response
shape are unchanged. What's different is that
`travelguru.agents.{flights,hotels,places,weather}` will now have
messages on them, visible in Kafka UI or via:

```bash
curl -H "Authorization: Bearer <admin token>" \
  http://localhost:8000/admin/kafka/health

curl -H "Authorization: Bearer <admin token>" \
  "http://localhost:8000/admin/kafka/lag?group_id=travelguru-aggregator-<session_id>"
```

## Monitoring / consumer lag

`GET /admin/kafka/lag` reports, per topic-partition, for a given consumer
group:

```json
{
  "group_id": "travelguru-monitor",
  "partitions": [
    {"topic": "travelguru.agents.flights", "partition": 0, "end_offset": 128, "committed_offset": 128, "lag": 0},
    {"topic": "travelguru.agents.hotels", "partition": 0, "end_offset": 128, "committed_offset": 121, "lag": 7}
  ]
}
```

`lag = end_offset - committed_offset`. Since each request spins up its
own short-lived group (`travelguru-aggregator-<session_id>`), lag on a
*specific* session's group tells you whether that request's aggregator
is still waiting on an agent. To watch steady-state health instead of
one request, point a long-running consumer at the topics under
`KAFKA_MONITOR_GROUP` (default `travelguru-monitor`) and query that
group_id.

## Known limitation

`kafka-python==2.0.2` fails to import on Python 3.12
(`ModuleNotFoundError: No module named 'kafka.vendor.six.moves'` - a
vendored-`six` incompatibility, not anything in this codebase). Pinned to
`kafka-python==3.0.8` instead, which fixes it.
