"""
Config for the voice sidecar. Deliberately the only place in this
folder that touches os.environ -- everything else takes config as
plain arguments, so nothing here can accidentally reach into the main
app's own config/env handling.
"""

from __future__ import annotations

import os


def voice_enabled() -> bool:
    return os.getenv("VOICE_ENABLED", "false").lower() == "true"


# Base URL of the main app's OWN public API -- the adapter is an HTTP
# client of this app, exactly like the browser frontend is, not a
# direct importer of its internal services. Defaults to localhost for
# local dev; set explicitly for a real deployment (this sidecar's own
# separate Lambda/preview env, per the brief -- production is not
# touched).
AGENT_API_BASE_URL = os.getenv("AGENT_API_BASE_URL", "http://localhost:8001")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID")

# Per-webhook-call HTTP timeout to the main app. Separate from the
# get_itinerary tool's own internal poll budget (voice/adapter.py) --
# this is the ceiling on any SINGLE request to the main API; the
# itinerary tool may make several such requests while polling.
WEBHOOK_HTTP_TIMEOUT_SECONDS = float(os.getenv("VOICE_WEBHOOK_TIMEOUT_SECONDS", "10"))

# Total wall-clock budget for get_itinerary's poll-for-result loop,
# covering the case where the main app's NEW_TRIP path is running
# asynchronously (queued, result delivered over a WebSocket the voice
# agent isn't connected to) rather than synchronously. Kept
# deliberately short for a voice interaction -- a caller on a live
# call won't wait 30+ seconds in silence; past this, the tool returns
# a graceful "still working on it" string instead of hanging.
ITINERARY_POLL_BUDGET_SECONDS = float(os.getenv("VOICE_ITINERARY_POLL_BUDGET_SECONDS", "18"))
