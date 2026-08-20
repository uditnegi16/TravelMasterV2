import asyncio

from mangum import Mangum

from main import app
from core.async_invoke import WORKER_TASK_MARKER, PROCESS_MESSAGE_TASK

_mangum_handler = Mangum(app)


def handler(event, context):
    """
    Dispatches between two genuinely different kinds of Lambda
    invocation: a real API Gateway HTTP request (handed to Mangum as
    always), or this function's own asynchronous self-invoke used to
    run a chat turn's heavy work outside the original request/response
    cycle (see core/async_invoke.py -- WORKER_TASK_MARKER is never
    present on a real API Gateway event, so this can't misfire on
    normal traffic).
    """
    if isinstance(event, dict) and event.get(WORKER_TASK_MARKER) == PROCESS_MESSAGE_TASK:
        from services.message_worker import process_message_turn

        payload = {k: v for k, v in event.items() if k != WORKER_TASK_MARKER}
        asyncio.run(process_message_turn(payload))
        return {"status": "ok"}

    return _mangum_handler(event, context)
