from upstash_redis import Redis
import os
from dotenv import load_dotenv

load_dotenv()

redis_client = Redis(
    url=os.getenv("UPSTASH_REDIS_REST_URL"),
    token=os.getenv("UPSTASH_REDIS_REST_TOKEN"),
)