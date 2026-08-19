"""
Real tests for the router's request/response translation -- confirms
each endpoint builds a sensible natural-language query from the
structured tool params ElevenLabs would supply, and returns the shape
declared in its response_model.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    from voice.router import router
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_search_destinations_translates_params_into_a_query(client):
    with patch("voice.router._search_destinations", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = "Goa is known for its beaches."

        response = client.post(
            "/voice/tools/search_destinations",
            json={"destination": "Goa", "question": "Is it good in December?"},
        )

    assert response.status_code == 200
    assert response.json() == {"answer": "Goa is known for its beaches."}
    called_query = mock_search.call_args[0][0]
    assert "Goa" in called_query
    assert "December" in called_query


def test_get_itinerary_translates_params_into_a_query(client):
    with patch("voice.router._get_itinerary", new_callable=AsyncMock) as mock_itinerary:
        mock_itinerary.return_value = "A 3-day trip to Goa."

        response = client.post(
            "/voice/tools/get_itinerary",
            json={
                "origin": "Delhi",
                "destination": "Goa",
                "travel_dates": "September 5",
                "travelers": "2 adults",
                "budget": "40000 rupees",
            },
        )

    assert response.status_code == 200
    assert response.json() == {"summary": "A 3-day trip to Goa."}
    called_query = mock_itinerary.call_args[0][0]
    assert "Delhi" in called_query and "Goa" in called_query and "40000" in called_query


def test_get_itinerary_uses_sensible_defaults_when_optional_params_omitted(client):
    with patch("voice.router._get_itinerary", new_callable=AsyncMock) as mock_itinerary:
        mock_itinerary.return_value = "ok"

        response = client.post(
            "/voice/tools/get_itinerary",
            json={"origin": "Delhi", "destination": "Goa", "travel_dates": "tomorrow"},
        )

    assert response.status_code == 200
    called_query = mock_itinerary.call_args[0][0]
    assert "1 adult" in called_query
    assert "flexible" in called_query
