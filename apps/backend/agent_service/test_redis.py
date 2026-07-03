from core.redis_client import redis_client

redis_client.set("travelguru:v2:test", "connected")

print(redis_client.get("travelguru:v2:test"))