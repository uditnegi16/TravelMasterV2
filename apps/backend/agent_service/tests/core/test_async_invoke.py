"""
Real tests for the dispatch between "invoke a real, separate Lambda
execution" (production) and "just schedule it on the current event
loop" (local dev, where there's no freeze-on-return to work around).
"""

from unittest.mock import MagicMock, patch

import pytest


def test_uses_real_lambda_self_invoke_when_running_in_lambda(monkeypatch):
    from core import async_invoke

    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "travelguru-agent-service-TravelGuruAgentFunction-abc")

    mock_boto3 = MagicMock()
    with patch.dict("sys.modules", {"boto3": mock_boto3}):
        async_invoke.invoke_message_worker({"session_id": "s1", "query": "Plan a trip"})

    mock_boto3.client.assert_called_once_with("lambda")
    call_kwargs = mock_boto3.client.return_value.invoke.call_args.kwargs
    assert call_kwargs["FunctionName"] == "travelguru-agent-service-TravelGuruAgentFunction-abc"
    assert call_kwargs["InvocationType"] == "Event"

    import json
    payload = json.loads(call_kwargs["Payload"])
    assert payload["session_id"] == "s1"
    assert payload[async_invoke.WORKER_TASK_MARKER] == async_invoke.PROCESS_MESSAGE_TASK


def test_runs_locally_when_not_in_lambda(monkeypatch):
    from core import async_invoke

    monkeypatch.delenv("AWS_LAMBDA_FUNCTION_NAME", raising=False)

    with patch.object(async_invoke, "_invoke_local") as mock_local:
        async_invoke.invoke_message_worker({"session_id": "s1"})

    mock_local.assert_called_once_with({"session_id": "s1"})


@pytest.mark.asyncio
async def test_local_invoke_schedules_the_worker_task():
    from core import async_invoke

    with patch("services.message_worker.process_message_turn") as mock_worker:
        async_invoke._invoke_local({"session_id": "s1"})
        import asyncio
        await asyncio.sleep(0)

    mock_worker.assert_called_once_with({"session_id": "s1"})


def test_local_invoke_from_threadpool_hands_off_to_server_loop_without_blocking():
    """post_message() runs in a threadpool thread with no event loop.
    The worker must be handed to the server's loop (manager.loop) and the
    call must return immediately -- not run the whole pipeline inline."""
    import asyncio
    import threading

    from api.websocket_manager import manager
    from core import async_invoke

    loop = asyncio.new_event_loop()
    t = threading.Thread(target=loop.run_forever, daemon=True)
    t.start()
    ran_on = {}
    done = threading.Event()

    async def fake_worker(payload):
        ran_on["loop"] = asyncio.get_running_loop()
        done.set()

    old_loop = manager.loop
    manager.set_loop(loop)
    try:
        with patch("services.message_worker.process_message_turn", side_effect=fake_worker):
            result = {}
            caller = threading.Thread(target=lambda: result.setdefault("r", async_invoke._invoke_local({"session_id": "s1"})))
            caller.start()
            caller.join(timeout=2)
            assert not caller.is_alive()
            assert done.wait(timeout=2)
        assert ran_on["loop"] is loop
    finally:
        manager.loop = old_loop
        loop.call_soon_threadsafe(loop.stop)


def test_local_worker_crash_is_logged_not_silently_swallowed(caplog):
    """A worker scheduled on the server loop has no one awaiting it; an
    exception must still reach the logs."""
    import asyncio
    import logging
    import threading

    from api.websocket_manager import manager
    from core import async_invoke

    loop = asyncio.new_event_loop()
    threading.Thread(target=loop.run_forever, daemon=True).start()
    done = threading.Event()

    async def crashing_worker(payload):
        loop.call_soon(done.set)
        raise RuntimeError("boom in worker")

    old_loop = manager.loop
    manager.set_loop(loop)
    try:
        with caplog.at_level(logging.ERROR, logger="core.async_invoke"), \
             patch("services.message_worker.process_message_turn", side_effect=crashing_worker):
            t = threading.Thread(target=lambda: async_invoke._invoke_local({"session_id": "s1"}))
            t.start(); t.join(timeout=2)
            assert done.wait(timeout=2)
            import time; time.sleep(0.2)  # let the done-callback run
        assert any("Local message worker crashed" in r.message for r in caplog.records)
    finally:
        manager.loop = old_loop
        loop.call_soon_threadsafe(loop.stop)