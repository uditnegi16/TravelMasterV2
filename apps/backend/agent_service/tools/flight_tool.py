from graph.state import TripPlanState
from services.flight_service import search_flights


def flight_tool(state: TripPlanState) -> TripPlanState:
    trip = state["parsed_trip"]
    print("\n===== PARSED TRIP =====")
    print(trip)
    print("=======================\n")
    flights = search_flights(
        origin=trip["origin"],
        destination=trip["destination"],
        departure_date=trip["start_date"],
        adults=trip["travelers"],
    )

    state["flights"] = flights

    return state