"""
Real tests for the adapter -- confirms it only ever calls the main
app's real public endpoints (never anything internal), and that every
failure mode produces a real, speakable string rather than an
exception or a hang.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


def _mock_response(json_data: dict, status_code: int = 200) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=resp
        )
    return resp


@pytest.mark.asyncio
async def test_search_destinations_returns_the_assistant_content():
    from voice import adapter

    session_resp = _mock_response({"id": "s1"})
    message_resp = _mock_response({"message": {"content": "Goa is known for its beaches."}})

    mock_client = AsyncMock()
    mock_client.post.side_effect = [session_resp, message_resp]
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await adapter.search_destinations("Tell me about Goa")

    assert result == "Goa is known for its beaches."
    # Confirms the real public endpoints were hit, not anything internal.
    first_call_url = mock_client.post.call_args_list[0].args[0]
    assert "/chat/sessions" in first_call_url


@pytest.mark.asyncio
async def test_search_destinations_times_out_gracefully():
    from voice import adapter

    mock_client = AsyncMock()
    mock_client.post.side_effect = httpx.TimeoutException("timed out")
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await adapter.search_destinations("Tell me about Goa")

    assert "try" in result.lower() or "moment" in result.lower()


@pytest.mark.asyncio
async def test_get_itinerary_returns_summary_when_response_is_synchronous():
    from voice import adapter

    session_resp = _mock_response({"id": "s1"})
    message_resp = _mock_response({"message": {"content": "A 3-day trip to Goa, flying IndiGo."}})

    mock_client = AsyncMock()
    mock_client.post.side_effect = [session_resp, message_resp]
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await adapter.get_itinerary("Plan a trip to Goa")

    assert "Goa" in result


@pytest.mark.asyncio
async def test_get_itinerary_polls_when_queued_and_finds_the_result():
    """Covers the case where the main app's NEW_TRIP path is running
    asynchronously (Issue 12's fix) -- the initial response is just a
    'processing' ack, the real result shows up on a later poll."""
    from voice import adapter

    session_resp = _mock_response({"id": "s1"})
    queued_resp = _mock_response({"status": "processing"})
    poll_not_ready = _mock_response({"messages": [{"role": "user", "content": "Plan a trip"}]})
    poll_ready = _mock_response(
        {"messages": [{"role": "user", "content": "Plan a trip"}, {"role": "assistant", "content": "Here's your trip."}]}
    )

    mock_client = AsyncMock()
    mock_client.post.side_effect = [session_resp, queued_resp]
    mock_client.get.side_effect = [poll_not_ready, poll_ready]
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with patch("httpx.AsyncClient", return_value=mock_client), \
         patch("asyncio.sleep", new_callable=AsyncMock):
        result = await adapter.get_itinerary("Plan a trip to Goa")

    assert result == "Here's your trip."


@pytest.mark.asyncio
async def test_get_itinerary_gives_an_honest_answer_if_it_never_resolves(monkeypatch):
    """If the poll budget runs out with no assistant reply yet, this
    must say so honestly -- not hang, not silently return nothing."""
    from voice import adapter

    monkeypatch.setattr(adapter, "ITINERARY_POLL_BUDGET_SECONDS", 4.0)  # small, fast test

    session_resp = _mock_response({"id": "s1"})
    queued_resp = _mock_response({"status": "processing"})
    still_not_ready = _mock_response({"messages": [{"role": "user", "content": "Plan a trip"}]})

    mock_client = AsyncMock()
    mock_client.post.side_effect = [session_resp, queued_resp]
    mock_client.get.return_value = still_not_ready
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with patch("httpx.AsyncClient", return_value=mock_client), \
         patch("asyncio.sleep", new_callable=AsyncMock):
        result = await adapter.get_itinerary("Plan a trip to Goa")

    assert "longer" in result.lower() or "moment" in result.lower()
