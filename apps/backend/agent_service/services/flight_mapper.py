from __future__ import annotations

from typing import Any

from shared.schemas import FlightOption


def map_flights(
    flights: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Converts enriched flight objects into the
    TravelMaster Flight DTO.

    Removes Duffel-specific fields that are not
    required outside the flight layer.
    """

    mapped: list[FlightOption] = []

    for flight in flights:

       raw_segments = flight.get("segments", [])

       segments = [
           {
               "origin": segment["origin"]["iata_code"],
               "destination": segment["destination"]["iata_code"],
               "origin_city": segment["origin"].get("city_name"),
               "destination_city": segment["destination"].get("city_name"),
               "departing_at": segment.get("departing_at"),
               "arriving_at": segment.get("arriving_at"),
               "carrier": (
                   segment.get("marketing_carrier", {}) or {}
               ).get("name"),
               "flight_number": segment.get("marketing_carrier_flight_number"),
           }
           for segment in raw_segments
       ]

       mapped.append(
    FlightOption(
        id=flight["id"],

        airline=flight["owner"],

        price=float(flight["total_amount"]),

        currency=flight["currency"],

        origin=flight["origin"],
        destination=flight["destination"],

        origin_city=flight["origin_city"],
        destination_city=flight["destination_city"],

        duration=flight["duration"],

        stops=flight["stops"],

        is_direct=flight["is_direct"],

        layover_airport=flight["layover_airport"],
        layover_city=flight["layover_city"],

        layover_duration_minutes=flight["layover_duration_minutes"],

        overnight_layover=flight["overnight_layover"],

        requires_layover_hotel=flight["requires_layover_hotel"],

        estimated_extra_cost=flight["estimated_extra_cost"],

        route_score=flight["route_score"],

        expires_at=flight["expires_at"],

        segments=segments,
    ).model_dump()
)
    return mapped