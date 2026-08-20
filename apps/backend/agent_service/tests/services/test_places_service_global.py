"""
Real test confirming the hardcoded India-only restriction is gone
from the places search (2026-08-19) -- this was forcing a geoname
search for any destination to only look within India's borders,
which is what caused "Japan" to return real places in Odisha, India
instead of Japan.
"""

from unittest.mock import MagicMock, patch

from services import places_service


def test_geoname_search_has_no_hardcoded_country_restriction():
    with patch.object(places_service.requests, "get") as mock_get:
        mock_geo_response = MagicMock()
        mock_geo_response.json.return_value = {"lat": 35.6762, "lon": 139.6503}
        mock_places_response = MagicMock()
        mock_places_response.json.return_value = []
        mock_get.side_effect = [mock_geo_response, mock_places_response]

        places_service._search_places_opentripmap("Tokyo")

    geoname_call_params = mock_get.call_args_list[0].kwargs["params"]
    assert "country" not in geoname_call_params
    assert geoname_call_params["name"] == "Tokyo"
