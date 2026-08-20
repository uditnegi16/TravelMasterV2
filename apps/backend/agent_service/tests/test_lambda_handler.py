"""
Real tests confirming lambda_handler.py correctly tells a real API
Gateway event apart from this function's own async self-invoke
payload.
"""

from unittest.mock import MagicMock, patch


def test_real_api_gateway_event_goes_to_mangum():
    import lambda_handler as lh

    with patch.object(lh, "_mangum_handler", return_value={"statusCode": 200}) as mock_mangum:
        result = lh.handler({"httpMethod": "POST", "path": "/chat/sessions"}, context=MagicMock())

    mock_mangum.assert_called_once()
    assert result == {"statusCode": 200}


def test_worker_payload_routes_to_async_worker_not_mangum():
    import lambda_handler as lh

    worker_event = {
        lh.WORKER_TASK_MARKER: lh.PROCESS_MESSAGE_TASK,
        "session_id": "s1",
        "query": "Plan a trip",
    }

    with patch.object(lh, "_mangum_handler") as mock_mangum, \
         patch("services.message_worker.process_message_turn") as mock_worker:
        result = lh.handler(worker_event, context=MagicMock())

    mock_mangum.assert_not_called()
    mock_worker.assert_called_once()
    passed_payload = mock_worker.call_args[0][0]
    assert lh.WORKER_TASK_MARKER not in passed_payload
    assert passed_payload["session_id"] == "s1"
    assert result == {"status": "ok"}
