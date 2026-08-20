"""
Real tests for the country-vs-city resolution bug (2026-08-19). A
real user test hit this exactly: "plan a trip to Japan" left
destination_city as the raw country name, which broke flights (no
IATA code resolved), hotels, and places all at once -- one root
cause, three broken symptoms.
"""

from graph.nodes.location_resolver_node import location_resolver_node


def _run(destination: str, origin: str = "delhi") -> dict:
    state = {
        "parsed_trip": {
            "origin": origin,
            "destination": destination,
            "start_date": "",
            "end_date": "",
        }
    }
    result = location_resolver_node(state)
    return result["parsed_trip"]


def test_country_name_resolves_to_a_real_default_city():
    trip = _run("Japan")
    assert trip["destination_city"] == "Tokyo"


def test_country_name_resolves_to_a_real_airport_code():
    """The actual real-world symptom this fixes: a country name never
    got an IATA code before, so flight search silently found nothing."""
    trip = _run("Japan")
    assert trip["destination"] == "NRT"


def test_real_city_name_still_works_unchanged():
    """Confirms the fix is additive -- a query that already names a
    real city (the common case, already working) isn't affected."""
    trip = _run("Goa")
    assert trip["destination_city"] == "Goa"
    assert trip["destination"] == "GOI"


def test_country_substitution_also_applies_to_origin():
    trip = _run(destination="Goa", origin="UAE")
    assert trip["origin_city"] == "Dubai"
    assert trip["origin"] == "DXB"


def test_unrecognized_place_falls_through_unresolved_not_crashed():
    """A place that's neither a known city nor a known country --
    must not crash, even though it can't be resolved to an airport."""
    trip = _run("Nowheresville")
    assert trip["destination_city"] == "Nowheresville"
    # Falls back to the original (case-preserved) input string when no
    # IATA match exists -- confirms this doesn't silently invent a
    # wrong code, and doesn't crash on an unrecognized place.
    assert trip["destination"] == "Nowheresville"
