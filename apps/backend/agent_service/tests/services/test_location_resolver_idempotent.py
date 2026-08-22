"""
Regression tests for the 2026-08-22 production bug: location_resolver_node
was not idempotent.

The node overwrites trip["destination"] with an IATA code. MODIFY_TRIP
feeds the previous parsed_trip back through the graph, so the node ran
again over its own output. "NRT" matched nothing in either lookup table,
so destination_city degraded to "Nrt" -- which fuzzy-matched to Nakhon Si
Thammarat, Thailand in the hotel search and was expanded by the LLM to
"Narita (NRT)" for weather and places.
"""

from graph.nodes.location_resolver_node import location_resolver_node


def _resolve(origin, destination):
    state = {
        "parsed_trip": {"origin": origin, "destination": destination},
        "progress_callback": None,
    }
    return location_resolver_node(state)["parsed_trip"]


def test_country_resolves_to_default_city():
    trip = _resolve("Delhi", "Japan")
    assert trip["destination_city"] == "Tokyo"
    assert trip["destination"] == "NRT"
    assert trip["origin_city"] == "Delhi"
    assert trip["origin"] == "DEL"


def test_resolver_is_idempotent_across_repeated_modify_turns():
    """The actual bug: each MODIFY_TRIP turn re-ran this node."""
    trip = _resolve("Delhi", "Japan")

    for _ in range(5):
        state = {"parsed_trip": dict(trip), "progress_callback": None}
        trip = location_resolver_node(state)["parsed_trip"]

        assert trip["destination_city"] == "Tokyo", (
            f"destination_city degraded to {trip['destination_city']!r} "
            "-- this is what produced Thai hotels for a Japan trip"
        )
        assert trip["destination"] == "NRT"
        assert trip["origin_city"] == "Delhi"
        assert trip["origin"] == "DEL"


def test_a_real_destination_change_still_applies():
    """The fix must not pin the destination to whatever it was first."""
    trip = _resolve("Delhi", "Japan")
    trip["destination"] = "Osaka"

    state = {"parsed_trip": trip, "progress_callback": None}
    trip = location_resolver_node(state)["parsed_trip"]

    assert trip["destination_city"] == "Osaka"
    assert trip["destination"] == "KIX"


def test_lowercased_leftover_code_recovers():
    trip = _resolve("del", "nrt")
    assert trip["destination_city"] == "Tokyo"
    assert trip["destination"] == "NRT"


def test_reverse_map_prefers_the_canonical_city_name():
    from graph.nodes.location_resolver_node import AIRPORT_TO_CITY

    assert AIRPORT_TO_CITY["DEL"] == "delhi"      # not "new delhi"
    assert AIRPORT_TO_CITY["BOM"] == "mumbai"     # not "bombay"
    assert AIRPORT_TO_CITY["NRT"] == "tokyo"
