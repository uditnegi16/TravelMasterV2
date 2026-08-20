"""
Real tests confirming post_message() dispatches NEW_TRIP/MODIFY_TRIP
to the async worker and returns immediately (the fix for requests
getting cut off by API Gateway's ~29s timeout), while FOLLOW_UP/
INFO_REQUEST/GENERAL_CHAT stay exactly as they were -- single quick
calls that were never the cause of the timeout.
"""

from unittest.mock import MagicMock, patch

import pytest


def _fake_user(clerk_sub: str = "clerk_user_a"):
    user = MagicMock()
    user.payload = {"sub": clerk_sub}
    return user


def test_new_trip_dispatches_to_async_worker_and_returns_immediately():
    from api import chat_routes
    from api.chat_schemas import SendMessageRequest

    body = SendMessageRequest(device_id="dev-1", query="Plan a trip to Goa")

    with patch.object(chat_routes.chat_service, "assert_session_owner", return_value={"id": "s1", "title": "Trip"}), \
         patch.object(chat_routes.chat_service, "add_message"), \
         patch.object(chat_routes.chat_service, "maybe_set_title_from_first_message"), \
         patch.object(chat_routes.chat_service, "get_last_trip", return_value=None), \
         patch.object(chat_routes.chat_service, "classify_message", return_value="NEW_TRIP"), \
         patch.object(chat_routes.chat_service, "get_recent_history", return_value=[]), \
         patch.object(chat_routes.quota_guard, "check_and_increment_quota") as mock_quota, \
         patch.object(chat_routes, "invoke_message_worker") as mock_invoke:
        result = chat_routes.post_message("s1", body, user=_fake_user())

    mock_quota.assert_called_once()
    mock_invoke.assert_called_once()
    worker_payload = mock_invoke.call_args[0][0]
    assert worker_payload["session_id"] == "s1"
    assert worker_payload["conversation_type"] == "NEW_TRIP"
    assert worker_payload["is_billable_turn"] is True

    assert result["status"] == "processing"
    assert "message" not in result


def test_modify_trip_also_dispatches_to_async_worker():
    from api import chat_routes
    from api.chat_schemas import SendMessageRequest

    body = SendMessageRequest(device_id="dev-1", query="Make it cheaper")

    with patch.object(chat_routes.chat_service, "assert_session_owner", return_value={"id": "s1"}), \
         patch.object(chat_routes.chat_service, "add_message"), \
         patch.object(chat_routes.chat_service, "maybe_set_title_from_first_message"), \
         patch.object(chat_routes.chat_service, "get_last_trip", return_value={"parsed_trip": {}}), \
         patch.object(chat_routes.chat_service, "classify_message", return_value="MODIFY_TRIP"), \
         patch.object(chat_routes.chat_service, "get_recent_history", return_value=[]), \
         patch.object(chat_routes.quota_guard, "check_and_increment_quota"), \
         patch.object(chat_routes, "invoke_message_worker") as mock_invoke:
        result = chat_routes.post_message("s1", body, user=_fake_user())

    mock_invoke.assert_called_once()
    assert result["status"] == "processing"


def test_follow_up_stays_synchronous_unchanged():
    from api import chat_routes
    from api.chat_schemas import SendMessageRequest

    body = SendMessageRequest(device_id="dev-1", query="What's the weather like there?")

    with patch.object(chat_routes.chat_service, "assert_session_owner", return_value={"id": "s1"}), \
         patch.object(chat_routes.chat_service, "add_message", return_value={"id": "m1", "content": "It's sunny."}), \
         patch.object(chat_routes.chat_service, "maybe_set_title_from_first_message"), \
         patch.object(chat_routes.chat_service, "get_last_trip", return_value={"parsed_trip": {}}), \
         patch.object(chat_routes.chat_service, "classify_message", return_value="FOLLOW_UP"), \
         patch.object(chat_routes.chat_service, "get_recent_history", return_value=[]), \
         patch.object(chat_routes.chat_service, "touch_session"), \
         patch.object(chat_routes, "itinerary_qa_node", return_value="It's sunny."), \
         patch.object(chat_routes, "invoke_message_worker") as mock_invoke:
        result = chat_routes.post_message("s1", body, user=_fake_user())

    mock_invoke.assert_not_called()
    assert "status" not in result
    assert result["message"]["content"] == "It's sunny."


def test_info_request_also_stays_synchronous():
    """INFO_REQUEST (2026-08-19) calls exactly one real tool -- a few
    seconds at most, never the cause of the timeout, so it must NOT
    go through the async worker either, same as FOLLOW_UP."""
    from api import chat_routes
    from api.chat_schemas import SendMessageRequest

    body = SendMessageRequest(device_id="dev-1", query="Where else can I visit?")

    with patch.object(chat_routes.chat_service, "assert_session_owner", return_value={"id": "s1"}), \
         patch.object(chat_routes.chat_service, "add_message", return_value={"id": "m1", "content": "Try the beach."}), \
         patch.object(chat_routes.chat_service, "maybe_set_title_from_first_message"), \
         patch.object(chat_routes.chat_service, "get_last_trip", return_value={"parsed_trip": {"destination_city": "Goa"}}), \
         patch.object(chat_routes.chat_service, "classify_message", return_value="INFO_REQUEST"), \
         patch.object(chat_routes.chat_service, "get_recent_history", return_value=[]), \
         patch.object(chat_routes.chat_service, "touch_session"), \
         patch.object(chat_routes, "info_request_node", return_value="Try the beach."), \
         patch.object(chat_routes, "invoke_message_worker") as mock_invoke:
        result = chat_routes.post_message("s1", body, user=_fake_user())

    mock_invoke.assert_not_called()
    assert "status" not in result
    assert result["message"]["content"] == "Try the beach."


def test_guest_new_trip_also_dispatches_correctly():
    """Guests (Issue 1) get the same async treatment -- account_id in
    the worker payload is None, matching the existing guest design."""
    from api import chat_routes
    from api.chat_schemas import SendMessageRequest

    body = SendMessageRequest(device_id="dev-1", query="Plan a trip to Goa")

    with patch.object(chat_routes.chat_service, "assert_guest_session_owner", return_value={"id": "s1"}), \
         patch.object(chat_routes.chat_service, "add_message"), \
         patch.object(chat_routes.chat_service, "maybe_set_title_from_first_message"), \
         patch.object(chat_routes.chat_service, "get_last_trip", return_value=None), \
         patch.object(chat_routes.chat_service, "classify_message", return_value="NEW_TRIP"), \
         patch.object(chat_routes.chat_service, "get_recent_history", return_value=[]), \
         patch.object(chat_routes.quota_guard, "check_and_increment_quota") as mock_quota, \
         patch.object(chat_routes, "invoke_message_worker") as mock_invoke:
        result = chat_routes.post_message("s1", body, user=None)

    mock_quota.assert_not_called()
    worker_payload = mock_invoke.call_args[0][0]
    assert worker_payload["account_id"] is None
    assert result["status"] == "processing"
