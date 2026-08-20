from datetime import datetime

from graph.state import TripPlanState

from graph.progress_utils import emit_progress

# 2026-08-19: a real user test hit this exactly -- "plan a trip to
# Japan" left destination_city as the raw country name ("Japan"),
# which then broke flights (no IATA code for "japan" in
# CITY_TO_AIRPORT below, so no flight search could run at all --
# this is what "No flight available" actually meant), hotels
# (Nominatim's structured city= search doesn't handle a country name
# well, returning unrelated fuzzy matches), and places (compounded by
# a separate hardcoded India restriction in places_service.py, fixed
# separately). One root cause producing three different-looking
# symptoms. This maps a country name to a sensible, well-connected
# default city BEFORE the existing city/airport lookup runs, so
# "Japan" resolves to Tokyo the same way a user meaning Tokyo would
# have been resolved if they'd said so directly.
COUNTRY_TO_DEFAULT_CITY = {
    "japan": "tokyo",
    "india": "delhi",
    "uae": "dubai",
    "united arab emirates": "dubai",
    "thailand": "bangkok",
    "singapore": "singapore",
    "malaysia": "kuala lumpur",
    "indonesia": "bali",
    "south korea": "seoul",
    "hong kong": "hong kong",
    "maldives": "male",
    "uk": "london",
    "united kingdom": "london",
    "england": "london",
    "france": "paris",
    "netherlands": "amsterdam",
    "italy": "rome",
    "spain": "barcelona",
    "germany": "berlin",
    "switzerland": "zurich",
    "austria": "vienna",
    "turkey": "istanbul",
    "usa": "new york",
    "united states": "new york",
    "america": "new york",
    "canada": "toronto",
    "australia": "sydney",
    "new zealand": "auckland",
    "south africa": "cape town",
    "kenya": "nairobi",
    "egypt": "cairo",
}

CITY_TO_AIRPORT = {
    # India
    "delhi": "DEL",
    "new delhi": "DEL",
    "mumbai": "BOM",
    "bombay": "BOM",
    "bengaluru": "BLR",
    "bangalore": "BLR",
    "chennai": "MAA",
    "kolkata": "CCU",
    "calcutta": "CCU",
    "hyderabad": "HYD",
    "pune": "PNQ",
    "goa": "GOI",
    "panaji": "GOI",
    "ahmedabad": "AMD",
    "jaipur": "JAI",
    "kochi": "COK",
    "cochin": "COK",
    "thiruvananthapuram": "TRV",
    "trivandrum": "TRV",
    "lucknow": "LKO",
    "chandigarh": "IXC",
    "bhubaneswar": "BBI",
    "indore": "IDR",
    "nagpur": "NAG",
    "surat": "STV",
    "visakhapatnam": "VTZ",
    "vizag": "VTZ",
    "patna": "PAT",
    "ranchi": "IXR",
    "guwahati": "GAU",
    "amritsar": "ATQ",
    "varanasi": "VNS",
    "agra": "AGR",
    "udaipur": "UDR",
    "jodhpur": "JDH",
    "dehradun": "DED",
    "srinagar": "SXR",
    "leh": "IXL",
    "port blair": "IXZ",

    # Asia
    "dubai": "DXB",
    "abu dhabi": "AUH",
    "doha": "DOH",
    "singapore": "SIN",
    "bangkok": "BKK",
    "kuala lumpur": "KUL",
    "tokyo": "NRT",
    "osaka": "KIX",
    "seoul": "ICN",
    "hong kong": "HKG",
    "bali": "DPS",
    "denpasar": "DPS",
    "jakarta": "CGK",
    "phuket": "HKT",
    "male": "MLE",

    # Europe
    "london": "LHR",
    "paris": "CDG",
    "amsterdam": "AMS",
    "rome": "FCO",
    "milan": "MXP",
    "barcelona": "BCN",
    "madrid": "MAD",
    "berlin": "BER",
    "munich": "MUC",
    "zurich": "ZRH",
    "vienna": "VIE",
    "istanbul": "IST",

    # North America
    "new york": "JFK",
    "los angeles": "LAX",
    "san francisco": "SFO",
    "chicago": "ORD",
    "las vegas": "LAS",
    "miami": "MIA",
    "toronto": "YYZ",
    "vancouver": "YVR",

    # Oceania
    "sydney": "SYD",
    "melbourne": "MEL",
    "auckland": "AKL",

    # Africa
    "cape town": "CPT",
    "johannesburg": "JNB",
    "nairobi": "NBO",
    "cairo": "CAI"
}


def normalize_date(date_str: str) -> str:
    """
    Converts common natural language dates into YYYY-MM-DD.

    Examples:
    July 25
    Oct 10
    December 5
    """

    if not date_str:
        return ""

    current_year = datetime.now().year

    formats = [
        "%B %d",
        "%b %d",
        "%d %B",
        "%d %b",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            dt = dt.replace(year=current_year)

            return dt.strftime("%Y-%m-%d")

        except ValueError:
            pass

    return date_str


def location_resolver_node(state: TripPlanState) -> TripPlanState:
    emit_progress(
        state,
        "resolver",
        "started",
        "Resolving locations...",
    )

    try:
        trip = state["parsed_trip"]

        origin = trip.get("origin", "").lower().strip()
        destination = trip.get("destination", "").lower().strip()

        # If the extracted value is a country name, not an actual
        # city, substitute a sensible default city before anything
        # else runs -- see COUNTRY_TO_DEFAULT_CITY's comment above for
        # the real bug this fixes.
        origin = COUNTRY_TO_DEFAULT_CITY.get(origin, origin)
        destination = COUNTRY_TO_DEFAULT_CITY.get(destination, destination)

        origin_city = origin.title()
        trip["origin_city"] = origin_city

        trip["origin"] = CITY_TO_AIRPORT.get(
            origin,
            trip.get("origin", ""),
        )

        destination_city = destination.title()
        trip["destination_city"] = destination_city

        trip["destination"] = CITY_TO_AIRPORT.get(
            destination,
            trip.get("destination", ""),
        )

        trip["start_date"] = normalize_date(
            trip.get("start_date", "")
        )

        trip["end_date"] = normalize_date(
            trip.get("end_date", "")
        )

        state["parsed_trip"] = trip

        emit_progress(
            state,
            "resolver",
            "completed",
        )

        return state

    except Exception:
        emit_progress(
            state,
            "resolver",
            "failed",
        )
        raise