# Voice Sidecar (branch: `feat/voice-agent`)

An ElevenLabs conversational voice agent, built as a genuinely removable sidecar to TravelMasterV2 -- not a component inside it. Nothing in the existing LangGraph workflow, retrieval agents, pgvector setup, DB schema, or existing frontend components was changed to build this.

## What this is

- A voice agent (configured in the ElevenLabs dashboard) that calls two webhook tools exposed here: `search_destinations` (general questions about a place) and `get_itinerary` (a full trip plan).
- Both tools are thin translators: structured params in, one real HTTP call to this app's own **public** API (the same guest-trial, no-account path the browser frontend uses -- see `voice/adapter.py`), one short speakable string out.
- A floating widget on the frontend (ElevenLabs' own embed pattern, lazy-loaded, flag-gated) that lets a visitor actually talk to the agent.
- A standalone latency benchmark (`voice/bench/latency_bench.py`) comparing Flash v2.5, Turbo v2.5, and Multilingual v2 time-to-first-byte.

## What this deliberately does NOT do

- No direct database access, no new tables, no new migrations.
- No privileged internal calls -- the adapter is an HTTP client of the main app's own API, not an importer of `chat_service` or anything else internal. If the main app's public API changed shape, this would break the same way the real frontend would.
- No new npm/pip dependencies beyond what's already transitively present (`httpx` on the backend, already pulled in by FastAPI/langchain; the frontend widget uses ElevenLabs' own script-tag embed, not an installed package).

## Enabling it

Backend (`apps/backend/agent_service/voice/.env.example` -> your real `.env`):
```
VOICE_ENABLED=true
AGENT_API_BASE_URL=http://localhost:8001   # or your deployed agent service URL
```

Frontend (`apps/frontend/.env.example` -> your real `.env`):
```
VITE_VOICE_ENABLED=true
VITE_ELEVENLABS_AGENT_ID=your_real_agent_id
```

Both default to off. With either flag left at its default, the corresponding code is never even imported (backend: confirmed empirically -- `app.openapi()["paths"]` contains zero `/voice/tools/*` entries when `VOICE_ENABLED` is unset; frontend: the widget component ships as its own separate lazy-loaded chunk, confirmed in the real build output, never fetched unless the flag is on).

## Deploying it

Per the brief: separate preview deployment / separate Lambda, production untouched. This repo's `template.yml` isn't set up for a second Lambda target as part of this branch -- standing one up (a second SAM stack pointed at the same `apps/backend/agent_service` codebase, `VOICE_ENABLED=true`, its own API Gateway URL registered as the webhook base in the ElevenLabs dashboard) is real infrastructure work not included here, since it needs real AWS access to actually provision and verify. What's built is ready for that step, not a substitute for it.

## Removal procedure

The brief's own version of this list doesn't quite match what building it for real required -- a frontend widget genuinely needs one mount point to ever render, the same way the backend needs one mount line in `main.py`. Listed honestly, all six real steps:

1. Delete `apps/backend/agent_service/voice/` (router, adapter, config, tests, bench script, this README -- everything backend-side lives here)
2. Delete `apps/frontend/src/voice-agent/` (the widget component + its lazy-loading wrapper)
3. In `apps/backend/agent_service/main.py`: remove the `voice.config`/`voice.router` import block and its `app.include_router(voice_agent_router)` call (clearly marked with `# --- ElevenLabs voice sidecar ---` comments)
4. In `apps/frontend/src/main.tsx`: remove the `VoiceAgentMount` import and the `<VoiceAgentMount />` line (also clearly marked)
5. Remove `VOICE_ENABLED`/`AGENT_API_BASE_URL`/`ELEVENLABS_API_KEY`/`ELEVENLABS_AGENT_ID` from `.env` and `VITE_VOICE_ENABLED`/`VITE_ELEVENLABS_AGENT_ID` from the frontend `.env.example` (2 lines added there, easy to find and remove)
6. Delete the branch

Steps 3 and 4 are the ones worth being upfront about -- a strictly zero-file-touch removable feature isn't actually achievable for anything that needs to render or route at all; this is the honest minimum, mirrored exactly on both sides, each one line plus its import.
