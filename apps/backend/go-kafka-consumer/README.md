# go-kafka-consumer

A standalone Go service that concurrently drains the four
`travelguru.agents.*` topics published by `kafka_bus/producer.py`, one
goroutine per topic, and reports per-topic throughput and processing
latency on `/metrics`. Built to benchmark against the Python consumer
path (`kafka_bus/consumer.py`) under load, and as the Go/concurrency
component of the stack alongside the Python agent service.

## Build

```bash
cd apps/backend/go-kafka-consumer
go mod tidy   # resolves and writes go.sum (needs network access to the Go module proxy)
go build -o go-kafka-consumer .
```

Or via Docker (no local Go toolchain needed):

```bash
docker build -t travelguru/go-kafka-consumer:latest .
```

## Run

```bash
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092
export KAFKA_CONSUMER_GROUP=travelguru-go-consumer
export PORT=9100
./go-kafka-consumer
```

```bash
curl localhost:9100/health
curl localhost:9100/metrics
```

`/metrics` response shape:

```json
{
  "travelguru.agents.flights": {
    "messages_processed": 128,
    "avg_latency_ms": 3,
    "max_latency_ms": 41,
    "last_message_at": "2026-07-17T10:04:22Z"
  }
}
```

## Benchmarking against the Python consumer

Both consumers read the same topics with the same message shape, so a
fair comparison is:

1. Start Kafka locally (`infra/kafka/docker-compose.yml`).
2. Run a load-generation script that publishes N synthetic agent-result
   payloads per topic (reuse `kafka_bus/producer.py`'s
   `publish_agent_result` in a small script, or use `kafkacat`/`kcat`).
3. Run the Python consumer (`AGENT_BUS=kafka` request path, or a
   standalone script calling `kafka_bus.consumer.collect_agent_results`
   in a loop) against the same load, note wall-clock time and CPU.
4. Run `go-kafka-consumer` against the same load, read `/metrics` for
   `avg_latency_ms` / `max_latency_ms` per topic and note wall-clock time
   and CPU.
5. Record p50/p99 processing latency and total throughput (messages/sec)
   for both. Use the actual numbers you measure, not projected ones, for
   any "reduced p99 latency from Xms to Yms" claim.

This service intentionally does the same no-op-beyond-decode processing
as a baseline so the comparison isolates consumer-loop/concurrency
overhead rather than differences in what each one does with a message.

## Deploying alongside the Kubernetes agent-service

Not yet wired into `k8s/agent-service/` since it's a separate workload
(a consumer, not something the trip-planning request path calls
synchronously). Add a `k8s/go-kafka-consumer/deployment.yaml` following
the same pattern as `k8s/agent-service/deployment.yaml` - readiness probe
on `/health`, no Service needed unless something outside the cluster
needs to scrape `/metrics` directly (a ServiceMonitor for Prometheus
would use a ClusterIP Service instead).
