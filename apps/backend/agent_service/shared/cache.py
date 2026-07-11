import json

from shared.logging_config import logger
from shared import metrics

from core.redis_client import redis_client


def get_cache(key: str):
    data = redis_client.get(key)

    if data:
        logger.info(f"Cache HIT | {key}")
        metrics.increment("cache_hit")
        return json.loads(data)

    logger.info(f"Cache MISS | {key}")
    metrics.increment("cache_miss")
    return None


def set_cache(key: str, value, ttl: int = 30):
    redis_client.set(
        key,
        json.dumps(value),
        ex=ttl,
    )