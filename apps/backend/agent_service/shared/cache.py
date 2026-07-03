import json

from shared.logging_config import logger

from core.redis_client import redis_client


def get_cache(key: str):
    data = redis_client.get(key)

    if data:
        logger.info(f"Cache HIT | {key}")
        return json.loads(data)

    logger.info(f"Cache MISS | {key}")
    return None


def set_cache(key: str, value, ttl: int = 30):
    redis_client.set(
        key,
        json.dumps(value),
        ex=ttl,
    )