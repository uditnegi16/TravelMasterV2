"""
Builds the shared LangGraph agent graph, reused by chat_routes.py
(from api.routes import graph).

Issue 8 (2026-08-02): the /plan-trip and /generate-pdf endpoints that
used to live here were removed -- they were dead on the frontend
(nothing called them; only the unrouted PlanTripPage.tsx did) but
still live and mounted on the real API, with no authentication and a
trivially-bypassable client-supplied "rate limit" key
(rate_key = f"...:{body.session_id}", where session_id is whatever
the caller sends). That meant every real fix from Issues 1/2/3/5
(guest-trial limits, account ownership, PDF ownership, real quotas)
could be sidestepped entirely just by calling these old endpoints
directly instead of /chat/*. Removed rather than re-secured -- the
real, current chat flow (chat_routes.py) already does everything
these did, correctly.
"""

print("routes: build_graph import")
from graph.build_graph import build_graph

print("routes: before build_graph")
graph = build_graph()
print("routes: after build_graph")
