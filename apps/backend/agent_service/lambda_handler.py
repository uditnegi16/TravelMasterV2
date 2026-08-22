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

        # NOT asyncio.run() (2026-08-20, real production bug): it
        # always closes the event loop it creates when finished --
        # fine in isolation, but Lambda reuses the same warm container
        # across invocations. Once this loop is closed, the SAME
        # container later handling a normal HTTP request through
        # Mangum crashes with "There is no current event loop in
        # thread 'MainThread'" the moment Mangum's own lifespan setup
        # calls asyncio.get_event_loop() -- confirmed directly in a
        # real production traceback. Get-or-create a loop and run on
        # it without closing it, so the container stays usable
        # afterward.
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        loop.run_until_complete(process_message_turn(payload))
        return {"status": "ok"}

    return _mangum_handler(event, context)
