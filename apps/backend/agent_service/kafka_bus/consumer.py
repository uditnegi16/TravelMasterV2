import time

import requests

from kafka_bus.config import AGGREGATOR_TIMEOUT_SECONDS
from shared.logging_config import logger


def collect_agent_results(session_id: str) -> dict:
    deadline = time.monotonic() + AGGREGATOR_TIMEOUT_SECONDS
    url = f"http://localhost:8081/result/{session_id}"

    while time.monotonic() < deadline:
        try:
            response = requests.get(url, timeout=2)

            if response.status_code == 200:
                logger.info(f"Go aggregator returned trip | session={session_id}")
                return response.json()

            if response.status_code != 404:
                logger.warning(
                    f"Go aggregator returned {response.status_code} | session={session_id}"
                )

        except Exception as e:
            logger.warning(f"Go aggregator unavailable | {e}")

        time.sleep(0.25)

    logger.warning(f"Go aggregator timed out | session={session_id}")
    return {}
