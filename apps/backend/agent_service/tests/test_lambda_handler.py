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


def test_event_loop_survives_worker_dispatch_for_later_mangum_use():
    """
    The real production bug (2026-08-20): asyncio.run() always closes
    the loop it creates -- fine in isolation, but Lambda reuses the
    same warm container across invocations. Once closed, the SAME
    container later handling a normal HTTP request through Mangum
    crashed with a real, confirmed production traceback:
    "RuntimeError: There is no current event loop in thread
    'MainThread'" inside Mangum's own lifespan setup. This test
    confirms the actual fix: the loop used for the worker dispatch is
    NOT closed afterward, so a subsequent asyncio.get_event_loop()
    call (exactly what Mangum's lifespan code does) still succeeds.
    """
    import asyncio

    import lambda_handler as lh

    worker_event = {
        lh.WORKER_TASK_MARKER: lh.PROCESS_MESSAGE_TASK,
        "session_id": "s1",
        "query": "Plan a trip",
    }

    with patch("services.message_worker.process_message_turn"):
        lh.handler(worker_event, context=MagicMock())

    # The real regression check -- asyncio.run() would have closed
    # this and made the next line raise.
    loop = asyncio.get_event_loop()
    assert not loop.is_closed()
