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
import logging
import os

logger = logging.getLogger(__name__)

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


def _log_worker_failure(fut) -> None:
    if fut.cancelled():
        return
    exc = fut.exception()
    if exc is not None:
        logger.error("Local message worker crashed", exc_info=exc)


# Strong references to locally-scheduled worker tasks -- asyncio only
# keeps a weak reference to a task, so an un-referenced one can be
# garbage-collected mid-run.
_local_tasks: set = set()


def _invoke_local(payload: dict) -> None:
    """
    post_message() is a plain `def` route, so FastAPI runs it in a
    threadpool thread -- which has NO event loop of its own. The old
    version called asyncio.get_event_loop() there, which raises on
    Python 3.10+ in a non-main thread, so it always fell into the
    asyncio.run() fallback: the whole 20-80s pipeline ran INLINE inside
    the HTTP request, on a throwaway loop, and every progress event was
    queued on that throwaway loop instead of the one that owns the
    browser's websocket -- so nothing reached the UI until the very end
    (and then usually not at all).

    Now: hand the worker to uvicorn's real loop (captured at startup in
    manager.loop), so the HTTP request returns immediately with
    "processing" exactly like production does, and the worker's
    websocket sends go out on the loop that actually holds the socket.
    """
    from api.websocket_manager import manager
    from services.message_worker import process_message_turn

    coro = process_message_turn(payload)

    # Already on a running loop (e.g. an async caller or a test).
    try:
        running = asyncio.get_running_loop()
    except RuntimeError:
        running = None

    if running is not None:
        task = running.create_task(coro)
        _local_tasks.add(task)
        task.add_done_callback(_local_tasks.discard)
        task.add_done_callback(_log_worker_failure)
        return

    # Normal local-dev case: called from a threadpool thread.
    main_loop = manager.loop
    if main_loop is not None and main_loop.is_running():
        future = asyncio.run_coroutine_threadsafe(coro, main_loop)
        # Nothing awaits this future, so an exception would otherwise be
        # stored on it and never seen -- log it instead.
        future.add_done_callback(_log_worker_failure)
        return

    # No server loop at all (a plain sync script/test) -- run it to
    # completion directly rather than silently dropping it.
    asyncio.run(coro)