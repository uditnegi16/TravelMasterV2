"""
Real tests for the async worker that does the actual heavy lifting
for NEW_TRIP/MODIFY_TRIP turns, extracted out of post_message() so
the original HTTP request doesn't have to wait on it.
"""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_successful_turn_sends_result_over_websocket():
    from services import message_worker

    fake_response = {"success": True, "trip": {"summary": "A lovely trip"}, "summary": "A lovely trip"}
    fake_stored_message = {"id": "msg-1", "role": "assistant", "content": "A lovely trip"}

    with patch.object(message_worker, "graph") as mock_graph, \
         patch.object(message_worker, "build_response", return_value=fake_response), \
         patch.object(message_worker.chat_service, "get_last_trip", return_value=None), \
         patch.object(message_worker.chat_service, "get_recent_history", return_value=[]), \
         patch.object(message_worker.chat_service, "add_message", return_value=fake_stored_message) as mock_add, \
         patch.object(message_worker.chat_service, "touch_session"), \
         patch.object(message_worker.manager, "send", new_callable=AsyncMock) as mock_send:
        mock_graph.invoke.return_value = {}

        await message_worker.process_message_turn(
            {
                "session_id": "sess-1",
                "query": "Plan a trip to Goa",
                "conversation_type": "NEW_TRIP",
                "account_id": "acct-1",
                "is_billable_turn": True,
            }
        )

    mock_add.assert_called_once_with("sess-1", "assistant", "A lovely trip", trip_data={"summary": "A lovely trip"})
    assert mock_send.call_args[0][0] == "sess-1"
    assert mock_send.call_args[0][1]["type"] == "result"


@pytest.mark.asyncio
async def test_worker_fetches_previous_trip_itself_not_from_payload():
    """The real fix (2026-08-20): a rich trip's full data, passed
    through the Lambda invoke payload, can exceed AWS's 1MB async
    invocation limit -- a real production 500 traced to exactly this.
    The worker must fetch it itself, by session_id, never rely on the
    caller having passed it through."""
    from services import message_worker

    real_previous_trip = {"parsed_trip": {"destination_city": "Rome"}}

    with patch.object(message_worker, "graph") as mock_graph, \
         patch.object(message_worker, "build_response", return_value={"summary": "ok", "trip": None}), \
         patch.object(message_worker.chat_service, "get_last_trip", return_value=real_previous_trip) as mock_get_trip, \
         patch.object(message_worker.chat_service, "get_recent_history", return_value=[]), \
         patch.object(message_worker.chat_service, "add_message", return_value={"id": "m1"}), \
         patch.object(message_worker.chat_service, "touch_session"), \
         patch.object(message_worker.manager, "send", new_callable=AsyncMock):
        mock_graph.invoke.return_value = {}

        # Payload deliberately contains NO previous_trip/conversation_history --
        # confirms the worker doesn't depend on the caller providing them.
        await message_worker.process_message_turn(
            {
                "session_id": "sess-1",
                "query": "Make it cheaper",
                "conversation_type": "MODIFY_TRIP",
                "account_id": "acct-1",
                "is_billable_turn": True,
            }
        )

    mock_get_trip.assert_called_once_with("sess-1")
    passed_state = mock_graph.invoke.call_args[0][0]
    assert passed_state["previous_trip"] == real_previous_trip


@pytest.mark.asyncio
async def test_failed_turn_refunds_quota_and_sends_error():
    from services import message_worker

    error_message = {"id": "msg-err", "role": "assistant", "content": "Sorry..."}

    with patch.object(message_worker, "graph") as mock_graph, \
         patch.object(message_worker.chat_service, "get_last_trip", return_value=None), \
         patch.object(message_worker.chat_service, "get_recent_history", return_value=[]), \
         patch.object(message_worker.chat_service, "add_message", return_value=error_message) as mock_add, \
         patch.object(message_worker.manager, "send", new_callable=AsyncMock) as mock_send, \
         patch.object(message_worker.quota_guard, "refund_quota") as mock_refund:
        mock_graph.invoke.side_effect = RuntimeError("provider timeout")

        await message_worker.process_message_turn(
            {
                "session_id": "sess-1",
                "query": "Plan a trip to Goa",
                "conversation_type": "NEW_TRIP",
                "account_id": "acct-1",
                "is_billable_turn": True,
            }
        )

    mock_refund.assert_called_once_with("acct-1")
    mock_send.assert_called_once_with("sess-1", {"type": "error", "message": error_message})
    assert mock_add.call_args[0][1] == "assistant"


@pytest.mark.asyncio
async def test_failed_turn_for_a_guest_does_not_try_to_refund_quota():
    from services import message_worker

    with patch.object(message_worker, "graph") as mock_graph, \
         patch.object(message_worker.chat_service, "get_last_trip", return_value=None), \
         patch.object(message_worker.chat_service, "get_recent_history", return_value=[]), \
         patch.object(message_worker.chat_service, "add_message", return_value={"id": "m1"}), \
         patch.object(message_worker.manager, "send", new_callable=AsyncMock), \
         patch.object(message_worker.quota_guard, "refund_quota") as mock_refund:
        mock_graph.invoke.side_effect = RuntimeError("boom")

        await message_worker.process_message_turn(
            {
                "session_id": "sess-1",
                "query": "Plan a trip",
                "conversation_type": "NEW_TRIP",
                "account_id": None,
                "is_billable_turn": True,
            }
        )

    mock_refund.assert_not_called()


@pytest.mark.asyncio
async def test_websocket_send_failure_does_not_raise():
    from services import message_worker

    with patch.object(message_worker, "graph") as mock_graph, \
         patch.object(message_worker, "build_response", return_value={"summary": "ok", "trip": None}), \
         patch.object(message_worker.chat_service, "get_last_trip", return_value=None), \
         patch.object(message_worker.chat_service, "get_recent_history", return_value=[]), \
         patch.object(message_worker.chat_service, "add_message", return_value={"id": "m1"}), \
         patch.object(message_worker.chat_service, "touch_session"), \
         patch.object(message_worker.manager, "send", new_callable=AsyncMock) as mock_send:
        mock_graph.invoke.return_value = {}
        mock_send.side_effect = Exception("connection gone")

        await message_worker.process_message_turn(
            {
                "session_id": "sess-1",
                "query": "Plan a trip",
                "conversation_type": "NEW_TRIP",
                "account_id": "acct-1",
                "is_billable_turn": True,
            }
        )
