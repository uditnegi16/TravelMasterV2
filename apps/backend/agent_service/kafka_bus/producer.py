import json
import threading

from kafka import KafkaProducer
from kafka.errors import KafkaError

from kafka_bus.config import KAFKA_BOOTSTRAP_SERVERS
from shared.logging_config import logger

_producer: KafkaProducer | None = None
_lock = threading.Lock()


def get_producer() -> KafkaProducer:
    """Lazily builds a single process-wide producer. Created on first use
    (not at import time) so importing this module never requires a
    reachable broker - only actually publishing does."""
    global _producer

    if _producer is None:
        with _lock:
            if _producer is None:
                _producer = KafkaProducer(
                    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    key_serializer=lambda k: k.encode("utf-8") if k else None,
                    acks="all",
                    retries=3,
                    linger_ms=5,
                )

    return _producer


def publish_agent_result(topic: str, session_id: str, payload: dict) -> None:
    """
    Fire-and-forget publish of one agent's result, keyed by session_id so
    the aggregator (kafka_bus.consumer.collect_agent_results) can
    correlate all four topics back to the same trip-planning request.

    Deliberately never raises: a broker outage should degrade the bus
    (aggregator times out, partial results returned), not take down trip
    planning the way an unhandled exception in a required node would.
    """
    try:
        producer = get_producer()
        future = producer.send(topic, key=session_id, value=payload)
        producer.flush(timeout=5)
        record_metadata = future.get(timeout=5)
        logger.info(
            f"Kafka publish OK | topic={topic} partition={record_metadata.partition} "
            f"offset={record_metadata.offset} session={session_id}"
        )
    except KafkaError as e:
        logger.error(f"Kafka publish failed | topic={topic} | session={session_id} | {e}")
    except Exception as e:
        logger.error(f"Kafka publish error | topic={topic} | session={session_id} | {e}")
