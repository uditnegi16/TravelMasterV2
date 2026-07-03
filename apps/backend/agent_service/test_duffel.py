from pprint import pprint

from services.flight_service import search_flights

flights = search_flights(
    origin="DEL",
    destination="NRT",
    departure_date="2026-10-10",
)

print(f"Flights Found: {len(flights)}")
print()

pprint(flights[0])