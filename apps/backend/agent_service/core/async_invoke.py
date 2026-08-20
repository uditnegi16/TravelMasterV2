"""
Kicks off a chat turn's heavy work (services/message_worker.py) as a
genuinely separate execution, so the original HTTP request can return
immediately instead of blocking on it.

In production (AWS Lambda): a Lambda function's execution effectively
freezes the moment it returns a response -- there's no "respond now,
keep working in the background" the way a normal long-running server
process allows. The only correct way to hand real work off is a
second, separate invocation. Uses Lambda's own asynchronous invoke
(InvocationType="Event") on the SAME function, dispatched back to
itself -- lambda_handler.py inspects the incoming event to tell a real
API Gateway request apart from this kind of self-invoke and routes
accordingly.

In local dev (plain uvicorn): there's no such freeze-on-return
constraint -- a real asyncio event loop keeps running between
requests -- so this just schedules the work directly on that loop
instead of round-tripping through a fake self-invoke.
"""

from __future__ import annotations

import asyncio
import json
import os

WORKER_TASK_MARKER = "_worker_task"
PROCESS_MESSAGE_TASK = "process_message"


def invoke_message_worker(payload: dict) -> None:
    function_name = os.getenv("AWS_LAMBDA_FUNCTION_NAME")

    if function_name:
        _invoke_lambda_async(function_name, payload)
    else:
        _invoke_local(payload)


def _invoke_lambda_async(function_name: str, payload: dict) -> None:
    import boto3

    client = boto3.client("lambda")
    client.invoke(
        FunctionName=function_name,
        InvocationType="Event",  # fire-and-forget -- does not wait for a response
        Payload=json.dumps({WORKER_TASK_MARKER: PROCESS_MESSAGE_TASK, **payload}).encode("utf-8"),
    )


def _invoke_local(payload: dict) -> None:
    from services.message_worker import process_message_turn

    try:
        loop = asyncio.get_event_loop()
        loop.create_task(process_message_turn(payload))
    except RuntimeError:
        # No running loop in this context (e.g. a plain sync test) --
        # run it to completion directly rather than silently dropping it.
        asyncio.run(process_message_turn(payload))
