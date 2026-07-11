"""
Lightweight MLOps metrics recorder.

Piggybacks on the Redis (Upstash) instance already used for chat
progress/cache — no new infrastructure. Every write is wrapped in a
try/except: metrics are best-effort observability, never allowed to
break the request they're measuring.

Storage shape, all under the "mlops:" namespace:
  - mlops:counter:<name>              -> INCRBY counter (e.g. cache hits)
  - mlops:latency:<name>              -> capped list of recent durations (ms)
  - mlops:events:<name>               -> capped list of recent JSON events
  - mlops:dist:<name>:<bucket>        -> counter per bucket (e.g. conversation_type)

Lists are capped client-side (LPUSH + LTRIM) so this never grows
unbounded even with no retention policy configured on Upstash.
"""

from __future__ import annotations

import json
import time
from contextlib import contextmanager
from typing import Any, Dict, Iterator, List

from core.redis_client import redis_client
from shared.logging_config import logger

MAX_SAMPLES = 200


def increment(name: str, by: int = 1) -> None:
    try:
        redis_client.incrby(f"mlops:counter:{name}", by)
    except Exception:
        logger.info("metrics increment failed | %s", name)


def increment_bucket(name: str, bucket: str, by: int = 1) -> None:
    try:
        redis_client.incrby(f"mlops:dist:{name}:{bucket}", by)
    except Exception:
        logger.info("metrics increment_bucket failed | %s/%s", name, bucket)


def record_latency(name: str, duration_ms: float, meta: Dict[str, Any] | None = None) -> None:
    try:
        entry = json.dumps({"ms": round(duration_ms, 2), "t": time.time(), **(meta or {})})
        key = f"mlops:latency:{name}"
        redis_client.lpush(key, entry)
        redis_client.ltrim(key, 0, MAX_SAMPLES - 1)
    except Exception:
        logger.info("metrics record_latency failed | %s", name)


def record_event(name: str, payload: Dict[str, Any]) -> None:
    try:
        entry = json.dumps({"t": time.time(), **payload})
        key = f"mlops:events:{name}"
        redis_client.lpush(key, entry)
        redis_client.ltrim(key, 0, MAX_SAMPLES - 1)
    except Exception:
        logger.info("metrics record_event failed | %s", name)


@contextmanager
def timer(name: str, meta: Dict[str, Any] | None = None) -> Iterator[None]:
    """Usage: `with timer("rag_retrieval"): ...`"""
    start = time.perf_counter()
    try:
        yield
    finally:
        record_latency(name, (time.perf_counter() - start) * 1000, meta)


def get_counter(name: str) -> int:
    try:
        value = redis_client.get(f"mlops:counter:{name}")
        return int(value) if value else 0
    except Exception:
        return 0


def get_distribution(name: str, buckets: List[str]) -> Dict[str, int]:
    result = {}
    for bucket in buckets:
        try:
            value = redis_client.get(f"mlops:dist:{name}:{bucket}")
            result[bucket] = int(value) if value else 0
        except Exception:
            result[bucket] = 0
    return result


def get_recent_latencies(name: str, limit: int = 50) -> List[Dict[str, Any]]:
    try:
        raw = redis_client.lrange(f"mlops:latency:{name}", 0, limit - 1)
        return [json.loads(r) for r in raw]
    except Exception:
        return []


def get_recent_events(name: str, limit: int = 20) -> List[Dict[str, Any]]:
    try:
        raw = redis_client.lrange(f"mlops:events:{name}", 0, limit - 1)
        return [json.loads(r) for r in raw]
    except Exception:
        return []


def latency_stats(samples: List[Dict[str, Any]]) -> Dict[str, float]:
    """avg/p50/p95/max over a list of {"ms": ...} samples."""
    values = sorted(s["ms"] for s in samples if "ms" in s)
    if not values:
        return {"avg_ms": 0.0, "p50_ms": 0.0, "p95_ms": 0.0, "max_ms": 0.0, "count": 0}

    def pct(p: float) -> float:
        idx = min(len(values) - 1, int(len(values) * p))
        return values[idx]

    return {
        "avg_ms": round(sum(values) / len(values), 2),
        "p50_ms": round(pct(0.5), 2),
        "p95_ms": round(pct(0.95), 2),
        "max_ms": round(values[-1], 2),
        "count": len(values),
    }
