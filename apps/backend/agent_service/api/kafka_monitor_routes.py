"""
Kafka cluster health / consumer-lag monitoring - the API-level equivalent
of the "cluster health, topic and consumer monitoring" Grafana panel this
project doesn't run its own Grafana instance for. Gated behind
require_admin like the rest of api/admin_routes.py.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import require_admin
from kafka_bus import admin as kafka_admin
from kafka_bus.topics import CONSUMER_GROUP

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/kafka",
    tags=["admin", "kafka"],
    dependencies=[Depends(require_admin)],
)


@router.get("/health")
def get_kafka_health():
    """Broker reachability + whether each expected agent topic exists."""
    try:
        return kafka_admin.get_cluster_health()
    except Exception as e:
        logger.exception("Kafka health check failed")
        raise HTTPException(status_code=503, detail=f"Kafka unreachable: {e}")


@router.get("/lag")
def get_kafka_lag(
    group_id: str = Query(
        default=CONSUMER_GROUP,
        description=(
            "Consumer group to inspect. Defaults to the base aggregator "
            "group name; per-session groups are named "
            f"'{CONSUMER_GROUP}-<session_id>' and are short-lived, so this "
            "is most useful pointed at a long-running group (e.g. the "
            "monitoring consumer) rather than a single request's group."
        ),
    ),
):
    """Per-partition lag (end_offset - committed_offset) across all four
    agent topics for the given consumer group."""
    try:
        return kafka_admin.get_consumer_lag(group_id)
    except Exception as e:
        logger.exception("Kafka lag check failed")
        raise HTTPException(status_code=503, detail=f"Kafka unreachable: {e}")
