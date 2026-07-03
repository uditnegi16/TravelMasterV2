import os

import requests
from dotenv import load_dotenv

load_dotenv()

DUFFEL_TOKEN = os.getenv("DUFFEL_API_TOKEN")

BASE_URL = "https://api.duffel.com"


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
):
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
        }
    }

    response = requests.post(
        f"{BASE_URL}/air/offer_requests",
        headers=HEADERS,
        json=payload,
        timeout=60,
    )

    response.raise_for_status()

    return response.json()
def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    adults: int = 1,
):
    response = create_offer_request(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        adults=adults,
    )

    offers = response["data"]["offers"]

    flights = []

    for offer in offers:
        flights.append(
                {
                    "id": offer["id"],
                    "total_amount": offer["total_amount"],
                    "currency": offer["total_currency"],
                    "owner": offer["owner"]["name"],
                    "expires_at": offer["expires_at"],

                    "origin": offer["slices"][0]["origin"]["iata_code"],
                    "destination": offer["slices"][0]["destination"]["iata_code"],

                    "origin_city": offer["slices"][0]["origin"]["city_name"],
                    "destination_city": offer["slices"][0]["destination"]["city_name"],

                    "duration": offer["slices"][0]["duration"],

                    "slices": offer["slices"],
                }
            )

    return flights