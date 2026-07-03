from datetime import datetime

from graph.state import TripPlanState


CITY_TO_AIRPORT = {
    "delhi": "DEL",
    "new delhi": "DEL",
    "mumbai": "BOM",
    "bangalore": "BLR",
    "goa": "GOI",
    "tokyo": "NRT",
    "japan": "NRT",
    "london": "LHR",
    "dubai": "DXB",
    "paris": "CDG",
    "singapore": "SIN",
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

    trip["origin"] = CITY_TO_AIRPORT.get(origin, trip.get("origin", ""))

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