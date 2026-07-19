"""
Cluster health / consumer-lag helpers backing the /admin/kafka/* endpoints
in api/kafka_monitor_routes.py. Mirrors what you'd otherwise wire up as a
Grafana panel: per-topic partition counts and per-consumer-group lag
(end_offset - committed_offset) for every partition it owns.
"""

from kafka import KafkaAdminClient, KafkaConsumer, TopicPartition
from kafka.errors import KafkaError

from kafka_bus.config import KAFKA_BOOTSTRAP_SERVERS
from kafka_bus.topics import ALL_AGENT_TOPICS
from shared.logging_config import logger


def get_cluster_health() -> dict:
    """Broker/topic-level view: is the cluster reachable, and does each
    expected agent topic exist with how many partitions."""
    admin = KafkaAdminClient(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)

    try:
        cluster_metadata = admin.describe_cluster()
        existing_topics = admin.list_topics()

        topics = []
        for topic in ALL_AGENT_TOPICS:
            topics.append(
                {
                    "topic": topic,
                    "exists": topic in existing_topics,
                }
            )

        return {
            "status": "up",
            "brokers": len(cluster_metadata.get("brokers", [])),
            "cluster_id": cluster_metadata.get("cluster_id"),
            "topics": topics,
        }
    except KafkaError as e:
        logger.error(f"Kafka cluster health check failed | {e}")
        return {"status": "down", "error": str(e)}
    finally:
        admin.close()


def get_consumer_lag(group_id: str) -> dict:
    """
    For a given consumer group, returns per-partition lag across all
    agent topics: lag = latest offset on the broker - group's committed
    offset. High/growing lag on one topic (e.g. flights consistently
    behind hotels/places/weather) is the signal that agent's tool is the
    bottleneck - the same thing this endpoint would surface as a Grafana
    panel in a real deployment.
    """
    consumer = KafkaConsumer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=group_id,
        enable_auto_commit=False,
    )

    try:
        partitions = []
        for topic in ALL_AGENT_TOPICS:
            topic_partitions = consumer.partitions_for_topic(topic)

            if not topic_partitions:
                partitions.append(
                    {"topic": topic, "error": "topic not found or has no partitions"}
                )
                continue

            tps = [TopicPartition(topic, p) for p in topic_partitions]
            end_offsets = consumer.end_offsets(tps)
            committed = {tp: consumer.committed(tp) for tp in tps}

            for tp in tps:
                end_offset = end_offsets.get(tp, 0)
                committed_offset = committed.get(tp) or 0
                partitions.append(
                    {
                        "topic": tp.topic,
                        "partition": tp.partition,
                        "end_offset": end_offset,
                        "committed_offset": committed_offset,
                        "lag": max(end_offset - committed_offset, 0),
                    }
                )

        return {"group_id": group_id, "partitions": partitions}
    finally:
        consumer.close()
