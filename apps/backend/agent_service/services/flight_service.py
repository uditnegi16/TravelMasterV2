import os
import requests

from shared.circuit_breaker import CircuitBreaker
from shared.logging_config import logger
from dotenv import load_dotenv

load_dotenv()

DUFFEL_TOKEN = os.getenv("DUFFEL_API_TOKEN")

BASE_URL = "https://api.duffel.com"

flight_breaker = CircuitBreaker()
HEADERS = {
    "Authorization": f"Bearer {DUFFEL_TOKEN}",
    "Duffel-Version": "v2",
    "Content-Type": "application/json",
    "Accept": "application/json",
}
def create_offer_request(
    origin: str,
    destination: str,
    departure_date: str,
    adults: int = 1,
    max_connections: int = 1,
):
    if not flight_breaker.can_execute():
        logger.warning("Duffel circuit is OPEN")

        raise Exception("Flight service temporarily unavailable")
    if not flight_breaker.can_execute():
        logger.warning("Duffel circuit is OPEN")

        raise Exception("Flight service temporarily unavailable")
    payload = {
        "data": {
            "slices": [
                {
                    "origin": origin,
                    "destination": destination,
                    "departure_date": departure_date,
                }
            ],
            "passengers": [
                {"type": "adult"} for _ in range(adults)
            ],
            "cabin_class": "economy",
            "max_connections": max_connections,
        }
    }

    try:
        response = requests.post(
            f"{BASE_URL}/air/offer_requests",
            headers=HEADERS,
            json=payload,
            timeout=60,
        )

        if response.status_code != 200:
            logger.error(response.text)

        response.raise_for_status()

        flight_breaker.record_success()

    except Exception:
        flight_breaker.record_failure()
        raise
        

    response.raise_for_status()

    flight_breaker.record_success()

    return response.json()
def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    adults: int = 1,
    flight_strategy: str = "prefer_direct",
):
    max_connections = 1

    if flight_strategy == "direct_only":
        max_connections = 0

    response = create_offer_request(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        adults=adults,
        max_connections=max_connections,
    )

    offers = response["data"]["offers"]

    flights = []

    for offer in offers:

        slice_data = offer["slices"][0]

        segments = slice_data["segments"]

        stops = max(0, len(segments) - 1)

        layover_airport = None
        layover_city = None

        if stops > 0:
            layover_airport = segments[0]["destination"]["iata_code"]
            layover_city = segments[0]["destination"]["city_name"]

        flights.append(
            {
                "id": offer["id"],
                "total_amount": offer["total_amount"],
                "currency": offer["total_currency"],
                "owner": offer["owner"]["name"],
                "expires_at": offer["expires_at"],

                "origin": slice_data["origin"]["iata_code"],
                "destination": slice_data["destination"]["iata_code"],

                "origin_city": slice_data["origin"]["city_name"],
                "destination_city": slice_data["destination"]["city_name"],

                "duration": slice_data["duration"],

                "stops": stops,

                "is_direct": stops == 0,

                "layover_airport": layover_airport,

                "layover_city": layover_city,

                "segments": segments,

                "slices": offer["slices"],
            }
        )

    return flights