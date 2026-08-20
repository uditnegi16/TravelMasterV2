"""
Real test for the narrative/trip-card hotel mismatch bug (2026-08-19).
A real user test caught the composer's narrative naming one hotel
while quoting a price that belonged to a different one shown on the
trip card. Root cause: the prompt showed two independently-sourced
hotel references that were never guaranteed to agree.
"""

from graph.nodes.composer_node import _itinerary_cost_summary


def test_cost_summary_includes_the_actual_priced_hotel_name():
    recommended_itinerary = {
        "total_flight_cost": 25467.0,
        "total_hotel_cost": 8500.0,
        "layover_cost": 0.0,
        "total_trip_cost": 33967.0,
        "remaining_budget": 56033.0,
        "within_budget": True,
        "hotels": [{"name": "Legends Hostel", "estimated_total_cost": 8500.0}],
    }

    summary = _itinerary_cost_summary(recommended_itinerary)

    assert summary["hotel_name"] == "Legends Hostel"
    assert summary["total_trip_cost"] == 33967.0


def test_cost_summary_handles_missing_hotels_gracefully():
    recommended_itinerary = {"total_trip_cost": 10000.0, "hotels": []}

    summary = _itinerary_cost_summary(recommended_itinerary)

    assert "hotel_name" not in summary
    assert summary["total_trip_cost"] == 10000.0


def test_cost_summary_still_returns_empty_dict_when_no_itinerary():
    assert _itinerary_cost_summary(None) == {}
    assert _itinerary_cost_summary({}) == {}
