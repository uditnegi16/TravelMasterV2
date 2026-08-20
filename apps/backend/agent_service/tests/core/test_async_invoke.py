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
