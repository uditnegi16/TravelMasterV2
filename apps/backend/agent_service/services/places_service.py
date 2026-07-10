import os

import requests
from dotenv import load_dotenv

from shared.logging_config import logger

load_dotenv()

# BUG FIX (Places always returned one generic "Top Attractions in {city}"
# entry, later "Jaipur"/Attraction with a bare city-search link): the
# original code called geolocator.geocode(city) - a free-text geocode of
# the city itself - and hardcoded one fake entry around that point.
#
# A first attempt fixed this using Nominatim structured tourism/historic/
# leisure queries (same technique already used for search_hotels()), but
# Nominatim's public instance enforces a strict 1 request/sec usage
# policy - firing off a dozen structured queries in a tight loop gets
# most of them throttled/empty, which is why only one result came back.
#
# Real fix: V1 of this project (before the V2 rewrite) already solved
# this using the OpenTripMap API (see agent_in_update/langgraph_agents/
# tools/places/adapters/opentripmap_api.py in the old repo) - a single
# geoname lookup + a single radius search, both real API calls, no rate
# limiting issue. V2's .env already had a blank OPENTRIPMAP_API_KEY
# placeholder reserved for exactly this. This ports just the API call +
# normalization from that adapter (not the NLP/enrichment/caching layers
# around it in V1, which are out of scope for this phase).
OPENTRIPMAP_API_KEY = os.getenv("OPENTRIPMAP_API_KEY", "")
OPENTRIPMAP_TIMEOUT = int(os.getenv("OPENTRIPMAP_TIMEOUT", "10"))

GEONAME_URL = "https://api.opentripmap.com/0.1/en/places/geoname"
RADIUS_URL = "https://api.opentripmap.com/0.1/en/places/radius"

# OpenTripMap "kinds" we want to keep, and how to label them for the UI.
# Order matters: first matching kind found wins the display category.
KIND_LABELS = [
    ("museums", "Museum"),
    ("theatres_and_entertainments", "Entertainment"),
    ("monuments_and_memorials", "Historic Monument"),
    ("fortifications", "Fort"),
    ("palaces", "Palace"),
    ("temples", "Temple"),
    ("religion", "Religious Site"),
    ("architecture", "Architecture"),
    ("historic", "Historic Site"),
    ("natural", "Natural Attraction"),
    ("gardens_and_parks", "Park"),
    ("cultural", "Cultural Site"),
    ("interesting_places", "Attraction"),
]

BLOCKED_KINDS = ("banks", "bank", "shops", "foods", "restaurants", "hotels", "accommodations")


def build_place_maps_url(name: str, city: str) -> str:
    query = f"{name},{city}".replace(" ", "+")

    return (
        f"https://www.google.com/maps/search/?api=1&query={query}"
    )


def _category_label(kinds: str) -> str:
    for kind_key, label in KIND_LABELS:
        if kind_key in kinds:
            return label

    return "Attraction"


def _search_places_opentripmap(city: str, radius_m: int = 10000, limit: int = 12) -> list[dict]:
    geo_res = requests.get(
        GEONAME_URL,
        params={
            "name": city,
            "country": "IN",
            "apikey": OPENTRIPMAP_API_KEY,
        },
        timeout=OPENTRIPMAP_TIMEOUT,
    )
    geo_res.raise_for_status()
    geo_data = geo_res.json()

    lat = geo_data.get("lat")
    lon = geo_data.get("lon")

    if lat is None or lon is None:
        logger.warning(f"OpenTripMap geoname returned no coordinates for city='{city}'")
        return []

    places_res = requests.get(
        RADIUS_URL,
        params={
            "radius": min(radius_m, 7000),
            "lon": lon,
            "lat": lat,
            "limit": min(limit * 3, 50),
            "kinds": "interesting_places,architecture,historic,cultural,religion,museums,monuments",
            "format": "json",
            "apikey": OPENTRIPMAP_API_KEY,
        },
        timeout=OPENTRIPMAP_TIMEOUT,
    )
    places_res.raise_for_status()
    raw_places = places_res.json()

    if not isinstance(raw_places, list):
        logger.warning(f"OpenTripMap unexpected response type: {type(raw_places)}")
        return []

    places = []
    seen_places = set()

    for item in raw_places:
        name = (item.get("name") or "").strip()

        if not name:
            continue

        place_key = name.lower()

        if place_key in seen_places:
            continue

        kinds = item.get("kinds") or ""

        if any(bad in kinds for bad in BLOCKED_KINDS):
            continue

        seen_places.add(place_key)

        point = item.get("point") or {}

        places.append(
            {
                "name": name,

                "category": _category_label(kinds),

                "latitude": point.get("lat"),

                "longitude": point.get("lon"),

                "maps_url": build_place_maps_url(name, city),
            }
        )

    return places[:limit]


def search_places(city: str) -> list[dict]:
    if not OPENTRIPMAP_API_KEY:
        logger.warning(
            "OPENTRIPMAP_API_KEY not configured - places search unavailable. "
            "Add a free key to .env (see OpenTripMap docs) to enable real "
            "attraction results."
        )
        return []

    try:
        return _search_places_opentripmap(city)
    except requests.RequestException as exc:
        logger.warning(f"OpenTripMap places search failed for '{city}': {exc}")
        return []