import os
import requests

from shared.circuit_breaker import CircuitBreaker
from shared.logging_config import logger
from services.currency_service import convert_to_inr
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


def _to_inr_amount(raw_amount, currency: str) -> float:
    # Duffel returns total_amount as a string ("688.52"), not a
    # number -- confirmed by the raw offer shape.
    amount = float(raw_amount)
    converted, was_converted = convert_to_inr(amount, currency)

    if not was_converted:
        logger.warning(
            f"Currency conversion failed for {amount} {currency} -- "
            f"displaying the raw, unconverted number. This will be "
            f"wrong if currency != INR."
        )

    return converted
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

        # Duffel answers 201 Created for offer_requests, so the old
        # "!= 200" check logged every SUCCESSFUL search as an error,
        # burying the real 422s in noise.
        if not response.ok:
            logger.error(
                f"Duffel {response.status_code} for "
                f"{origin}->{destination} on {departure_date!r}: "
                f"{response.text[:600]}"
            )

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
                "total_amount": _to_inr_amount(offer["total_amount"], offer["total_currency"]),
                "currency": "INR",
                # 2026-08-19: kept for transparency/debugging -- the
                # real bug this fixes (a EUR-quoted international
                # flight silently displayed as if the number were
                # already INR, understating cost ~10x) was only
                # noticed by comparing the narrative text against the
                # structured trip-cost card, which is much harder to
                # do without knowing what the original currency was.
                "original_amount": offer["total_amount"],
                "original_currency": offer["total_currency"],
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

            }
        )

    return flights