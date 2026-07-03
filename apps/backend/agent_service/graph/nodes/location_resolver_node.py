from datetime import datetime

from graph.state import TripPlanState


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
    trip = state["parsed_trip"]

    origin = trip.get("origin", "").lower().strip()
    destination = trip.get("destination", "").lower().strip()

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

    return state