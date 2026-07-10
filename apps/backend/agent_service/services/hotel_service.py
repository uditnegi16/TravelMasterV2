import requests

from shared.logging_config import logger

CITY_IATA_TO_CITY = {
    "DEL": "Delhi",
    "BOM": "Mumbai",
    "BLR": "Bengaluru",
    "MAA": "Chennai",
    "CCU": "Kolkata",
    "GOI": "Goa",
    "HYD": "Hyderabad",
    "PNQ": "Pune",
    "JAI": "Jaipur",
    "COK": "Kochi",
}


def build_booking_url(
    name: str,
    city: str,
    check_in: str | None = None,
    check_out: str | None = None,
) -> str:
    query = f"{name},{city}".replace(" ", "+")

    return (
        f"https://www.google.com/maps/search/?api=1&query={query}"
    )

# Nominatim structured-query "amenity" values that map to lodging.
# NOTE: Nominatim's structured search only accepts one amenity per request,
# so we issue one request per amenity type and merge the results.
# "resort" is not a real OSM amenity tag (it's tourism=resort), so it is
# queried separately via the "tourism" structured field below.
HOTEL_AMENITIES = ("hotel", "guest_house", "hostel", "motel")
HOTEL_TOURISM_TYPES = ("resort",)


def _query_nominatim(city: str, **structured_params) -> list[dict]:
    response = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={
            "city": city,
            "format": "json",
            "addressdetails": 1,
            "namedetails": 1,
            "extratags": 1,
            "limit": 20,
            **structured_params,
        },
        headers={
            "User-Agent": "TravelMasterV2",
        },
        timeout=15,
    )

    response.raise_for_status()
    return response.json()


def search_hotels(city: str) -> list[dict]:
    city = CITY_IATA_TO_CITY.get(
        city.upper(),
        city,
    )

    # BUG FIX (Phase 8 hotel search regression):
    # The previous version queried Nominatim with `q=<city>` (a bare
    # free-text place search). That returns geocoding results *for the
    # city itself* (administrative boundary / place node), whose `type`
    # is things like "city" or "administrative" - never "hotel". The
    # `type in (...)` filter then discarded everything, so
    # `search_hotels()` always returned [].
    #
    # Fix: use Nominatim's *structured* query with an explicit `amenity`
    # (or `tourism`) field, which asks Nominatim to search for POIs of
    # that category inside the given city, instead of searching for the
    # city as a place.
    data: list[dict] = []

    for amenity in HOTEL_AMENITIES:
        try:
            data.extend(_query_nominatim(city, amenity=amenity))
        except requests.RequestException as exc:
            logger.warning(f"Nominatim amenity query failed for {amenity}: {exc}")

    for tourism_type in HOTEL_TOURISM_TYPES:
        try:
            data.extend(_query_nominatim(city, tourism=tourism_type))
        except requests.RequestException as exc:
            logger.warning(f"Nominatim tourism query failed for {tourism_type}: {exc}")

    hotels = []
    seen_hotels = set()
    prices = [
        2500,
        3200,
        4500,
        6000,
        8500,
        12000,
    ]

    for index, item in enumerate(data):
        name = (
            item.get("name")
            or item.get("display_name", "").split(",")[0]
            or f"{city} Hotel {index+1}"
        )
        hotel_key = name.strip().lower()

        if hotel_key in seen_hotels:
            continue

        seen_hotels.add(hotel_key)
        lower_name = name.lower()

        INVALID_TYPES = (
            "restaurant",
            "canteen",
            "cafe",
            "bar",
            "grill",
            "dhaba",
            "mess",
            "food",
            "college",
            "university",
            "hospital",
            "school",
            "office",
            "mall",
            "shop",
            "market",
        )

        if any(word in lower_name for word in INVALID_TYPES):
            continue
        hotels.append(
            {
                "id": str(item.get("osm_id", index)),

                "name": name,

                "city": city,

                "address": item.get(
                    "display_name",
                    "",
                ),

                "latitude": float(item["lat"]),

                "longitude": float(item["lon"]),

                "rating": round(
                    3.7 + (index % 3) * 0.4,
                    1,
                ),

                "estimated_price_per_night": prices[
                    index % len(prices)
                ],

                "booking_url": build_booking_url(
                    name,
                    city,
                ),

                "amenities": [
                    "Free WiFi",
                    "Air Conditioning",
                    "Restaurant",
                ],
            }
        )

    hotels.sort(
        key=lambda hotel: (
            -hotel["rating"],
            hotel["estimated_price_per_night"],
        )
    )

    # NOTE (Phase 8.3 - packages look identical):
    # This used to cap results to the top 5 hotels here, sorted only by
    # rating/price. That meant Budget/Best Value/Luxury packages were all
    # picking from the same 5 generically-chosen hotels downstream, so a
    # genuinely cheap or genuinely high-end hotel could be excluded before
    # profile-specific ranking ever ran. Widen the pool so each profile has
    # real candidates to differentiate between; final per-profile lists are
    # trimmed later in hotel_optimizer.rank_hotels_for_profile().
    return hotels[:15]