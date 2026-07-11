# TravelGuru v2

**AI trip planning, rebuilt from first principles.** Describe a trip in one sentence, and a LangGraph multi-agent pipeline pulls real flights, real hotels, real places, and real weather, ranks them, grounds the writeup in a retrieval-augmented knowledge base, and streams back a narrated, bookable itinerary — with voice input, a chat-style planning surface, Razorpay premium billing, and an admin panel behind it.

TravelGuru v2 is a ground-up rebuild of the original [TravelMaster](https://github.com/uditnegi16/Travelmaster) project. Same core idea, production-minded engineering underneath: owned API keys instead of shared ones, graceful degradation when a provider goes down, a real payment flow, and a RAG layer that gives the AI actual travel knowledge instead of just summarizing API responses.

> "Plan a 5-day honeymoon trip from Delhi to Goa for 2, mid-range budget, first week of December"
>
> → Ranked flights · Ranked hotels · Nearby places · Live weather · AI-written itinerary, streamed turn by turn in a chat interface — with the whole trip re-plannable by just asking for a change.

---

## Project status

🚧 **Actively developed, running locally against real (free-tier) cloud services — not yet deployed to AWS.**

Development follows an 8-phase SDLC plan (see `docs/`). Per the commit history, **Phases 0–7 are complete**:

| Phase | Scope | Status |
|---|---|---|
| 0 | Repo skeleton, accounts, structured logging | ✅ |
| 1 | Core trip pipeline — real flights/hotels/places/weather, first agent graph | ✅ |
| 2 | Reliability — Redis caching, circuit breakers, dual-LLM fallback | ✅ |
| 3 | Payments — Razorpay checkout, webhook, subscription tier | ✅ |
| 4 | RAG knowledge brain — embeddings + retrieval into the composer prompt | ✅ |
| 5 | Streaming UX — WebSocket progress events, async PDF generation | ✅ |
| 6 | Mobile-responsive UI pass | ✅ |
| 7 | Differentiated features (multi-profile ranking, trip re-planning) | ✅ |
| 8 | AWS migration (Lambda + Amplify + SAM) | ⏳ not started — `lambda_handler.py` stubs exist in both services, no `template.yaml`/`amplify.yml` yet |

Since finishing the planned SDLC, additional work has landed that wasn't in the original plan: **Clerk authentication, voice input, a contact form, and a full ChatGPT-style session/chat interface** (session history, pin/rename, share links) replacing the original single-shot planner UI.

**Two backend services exist, but only one is real right now:**
- `agent_service` is where everything actually lives — the LangGraph agent, chat, payments, voice transcription, contact form, and the admin API.
- `mlops_service` is currently a health-check stub (`main.py` has two routes: `/` and `/health`). The SDLC plan calls for splitting business logic (auth, payments, admin) into this service; that split hasn't happened yet.

---

## How a trip request flows

```
                         ┌────────────────┐
   user message ───────► │  planner /     │   NEW_TRIP → planner_node
                         │  trip_modifier │   MODIFY_TRIP → trip_modifier_node
                         └───────┬────────┘
                                 ▼
                       location_resolver_node
                                 ▼
                        rag_retriever_node   ← cosine search over travel_knowledge (pgvector)
                                 ▼
                         tool_router_node
                                 ▼
                    ┌────────────────────────┐
                    │  flight_tool (Duffel)   │
                    │  hotel_tool (OSM/       │
                    │   Nominatim POI search) │
                    └───────────┬─────────────┘
                                 ▼
                       parallel_tools_node     ← places + weather fetched concurrently
                          (ThreadPoolExecutor)     (asyncio.gather, exceptions swallowed
                                 ▼                   per-tool so one dead API doesn't
                          composer_node               kill the whole plan)
                                 ▼
                    streamed AI narrative + ranked itinerary
```

`FOLLOW_UP` and `GENERAL_CHAT` turns never touch the graph at all — they're answered directly by `qa_node` for lower latency on ordinary chat replies.

---

## Tech stack

### Frontend
| | |
|---|---|
| Framework | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| Routing | React Router v7 |
| Auth | Clerk (`@clerk/clerk-react`) |
| Motion | Framer Motion |

### Backend — `agent_service` (the AI brain, port 8000)
| | |
|---|---|
| API | FastAPI, Mangum (Lambda adapter, unused until Phase 8) |
| Orchestration | LangGraph + LangChain |
| Primary LLM | Groq — `llama-3.3-70b-versatile` |
| Fallback LLM | NVIDIA NIM — `meta/llama-3.3-70b-instruct` (auto-fallback on Groq failure/timeout) |
| RAG embeddings | `sentence-transformers/all-MiniLM-L6-v2`, retrieved via a Supabase `match_travel_knowledge` RPC over pgvector |
| Voice | `faster-whisper` (local `base` model, int8, CPU) — no external speech API |
| Ranking | scikit-learn–style weighted scoring across price / rating / convenience, per risk profile (Budget Saver / Best Value / Luxury) |
| Reliability | Custom `CircuitBreaker` per external tool, `asyncio.gather(..., return_exceptions=True)` for graceful degradation |
| Cache / rate limiting | Upstash Redis |
| Payments | Razorpay (order creation, HMAC signature verification, webhook) |
| PDF | WeasyPrint |

### Backend — `mlops_service` (stub, port TBD)
FastAPI skeleton with `/` and `/health` only. Not wired into the frontend yet.

### Data sources (all real, all free-tier)
| Domain | Provider | Notes |
|---|---|---|
| Flights | **Duffel API** | Real offer search (SDLC plan originally specced Skyscanner + Kiwi fallback; the shipped code uses Duffel instead) |
| Hotels | **OpenStreetMap / Nominatim** structured POI search | Real hotel names, addresses, and coordinates; price and rating are currently synthesized (not yet a real pricing API), and the booking link opens a Google Maps search rather than a bookable listing |
| Places | **OpenTripMap** | Ported from the V1 project after Nominatim's 1 req/sec limit made it unusable for places |
| Weather | **Open-Meteo** (via Nominatim geocoding) | SDLC plan specced OpenWeather; shipped code uses Open-Meteo |

### Database & infra
| | |
|---|---|
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Clerk — JWT verified in `agent_service/core/auth.py`; roles (`user`/`admin`/`superadmin`) live in Clerk `publicMetadata`, not a DB table |
| Cache | Upstash Redis (serverless, REST-based) |
| Target infra (Phase 8) | AWS Lambda + API Gateway (backend), AWS Amplify (frontend), AWS SAM — same shape as the original TravelMaster deployment |

---

## Features

**Shipped and working:**
- Natural-language trip planning — no forms, describe the trip in plain English or speak it
- Chat-style planning surface with session history, rename, pin, and delete (like ChatGPT)
- Trip modification mid-conversation — "make it cheaper" re-enters the graph via `trip_modifier_node` instead of re-planning from scratch
- Live progress over WebSocket while the agent works, plus token-level streaming of the final narrative
- RAG-grounded answers — destination, visa, seasonal, and cultural knowledge pulled from a curated `knowledge_base/` (27 markdown files across destinations, visas, seasons, food, festivals, budgets, and travel styles)
- Three-way itinerary ranking (Budget Saver / Best Value / Luxury) with different price/flight/hotel score weightings per profile
- Voice input via local Whisper transcription
- Razorpay premium checkout with signature-verified payments and a real subscription tier
- Async PDF export and shareable, no-login trip links
- Admin panel: dashboard, user management (via Clerk), contact-submission triage, analytics, live health/monitoring, and MLOps metrics (latency, cache hit rate, retrieval counts, error rate — all Redis-backed rolling counters)
- Circuit breakers and parallel, failure-isolated tool calls so one dead provider doesn't take down the whole plan
- Dual-LLM fallback (Groq → NVIDIA NIM) with a separate Groq key reserved for the message classifier so it doesn't compete with planning/composing for quota

**Planned, not yet shipped (see Phase 8 and the gaps below):**
- AWS deployment (Lambda/Amplify/SAM) — currently local-only
- Real hotel pricing/availability (current hotel data is real POIs with synthetic prices)
- `mlops_service` business-logic split
- Paginated user list, audit log for admin role changes/bans, durable (non-Redis) MLOps metrics storage

---

## Repository structure

```
TravelGuruV2/
├── apps/
│   ├── frontend/                     ← React 19 + Vite
│   │   └── src/app/routes/
│   │       ├── public/               ← Landing, Pricing, About, Help, Contact, Terms, Privacy
│   │       ├── app/                  ← PlanTripPage, ChatPage
│   │       └── admin/                ← Dashboard, Users, Analytics, Monitoring, MLOps, Contact
│   └── backend/
│       ├── agent_service/            ← LangGraph agent + all real API routes (port 8000)
│       │   ├── graph/nodes/          ← planner, trip_modifier, location_resolver,
│       │   │                            rag_retriever, tool_router, composer
│       │   ├── tools/                ← flight_tool, hotel_tool
│       │   ├── services/             ← flight/hotel/places/weather/pdf/whisper/razorpay/...
│       │   ├── retrieval/            ← embedder, retriever, chunker, ingest (RAG pipeline)
│       │   ├── api/                  ← routes, chat_routes, admin_routes, payment_routes, voice_routes
│       │   └── lambda_handler.py     ← Mangum entrypoint (Phase 8)
│       └── mlops_service/            ← stub FastAPI service (health check only)
├── database/
│   ├── schema.sql                    ← placeholder — real tables (chat.sessions, chat.messages,
│   │                                     subscriptions, travel_knowledge, contact_messages) are
│   │                                     currently provisioned directly in Supabase
│   ├── indexes.sql
│   ├── admin_panel_migration.sql
│   └── match_travel_knowledge.sql    ← pgvector similarity-search RPC
├── knowledge_base/                   ← RAG source content (markdown, chunked + embedded)
└── docs/                             ← SDLC plan, decision log, setup guide, tech stack
```

---

## Local development — 3 terminals

### Prerequisites
- Python 3.12
- Node.js 18+
- A Supabase project (with the `vector` extension enabled)
- A Clerk application
- API keys: Groq, NVIDIA NIM (fallback), Duffel, OpenTripMap, Upstash Redis, Razorpay (test mode)

### Terminal 1 — Agent service (port 8000)
```bash
cd apps/backend/agent_service
```
Create `.env` (see [Environment variables](#environment-variables) below), then:
```bash
python -m venv .venv
.venv\Scripts\activate        # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
✅ Agent running at `http://127.0.0.1:8000`

### Terminal 2 — MLOps service (stub)
```bash
cd apps/backend/mlops_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
✅ Returns `{"status": "healthy"}` at `/health` — no real endpoints yet.

### Terminal 3 — Frontend (port 5173)
```bash
cd apps/frontend
npm install
npm run dev
```
✅ Frontend running at `http://localhost:5173`

> Note: several frontend files currently call `http://127.0.0.1:8000` directly rather than reading `VITE_API_BASE` — if you need a different port for the agent service locally, those call sites need updating too.

---

## Environment variables

Real keys, never committed — every one of these comes from an account you create yourself.

### `apps/backend/agent_service/.env`
```
GROQ_API_KEY=
GROQ_CLASSIFIER_API_KEY=       # optional — separate quota from the main Groq key
NVIDIA_API_KEY=
DUFFEL_API_TOKEN=
OPENTRIPMAP_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
PREMIUM_PLAN_AMOUNT=
PREMIUM_PLAN_CURRENCY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_AUTHORIZED_PARTIES=http://localhost:5173
```

### `apps/backend/mlops_service/.env`
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
CLERK_SECRET_KEY=
CLERK_JWKS_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
AWS_REGION=
SES_FROM_EMAIL=
APP_URL=
AGENT_SERVICE_URL=http://localhost:8000
```

### `apps/frontend/.env`
```
VITE_API_BASE=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=
VITE_RAZORPAY_KEY_ID=
```

---

## Database setup

1. Create a Supabase project and enable the `vector` extension.
2. Run `database/schema.sql` and `database/indexes.sql`.
3. Run `database/match_travel_knowledge.sql` to install the pgvector similarity-search RPC used by `retrieval/retriever.py`.
4. Run `database/admin_panel_migration.sql` before opening the admin panel's Contact tab — it adds the workflow-status column the `PATCH` route needs.
5. Ingest the knowledge base: run the embedding pipeline in `retrieval/ingest.py` to chunk and embed every file in `knowledge_base/` into the `travel_knowledge` table.

## Admin access

Roles live in Clerk `publicMetadata.role`, not a database table:

1. Clerk Dashboard → **Sessions** → **Customize session token** → add `{ "metadata": "{{user.public_metadata}}" }`.
2. Clerk Dashboard → **Users** → your user → **Metadata** → set public metadata to `{"role": "admin"}`.
3. Sign in — the app checks `payload.metadata.role` on every request via `core/auth.py`'s `require_admin` dependency.

Once you have one admin, you can promote or demote others from the Admin Panel's Users page instead of going back into Clerk.

---

## Known gaps

- Hotel results are real venues (via OSM) but simulated price/rating — no live pricing API is wired in yet.
- `mlops_service` is a stub; all real logic currently lives in `agent_service`.
- MLOps metrics (latency, cache hit rate, error rate) live in Redis counters with no durable store — they reset if Redis is flushed.
- Admin user list isn't paginated in the UI yet (backend supports `limit`/`offset`).
- No audit log yet for admin role changes or bans.
- AWS deployment (Phase 8) hasn't started — everything above runs against real cloud services (Supabase, Upstash, Groq, Razorpay test mode) but from local dev, not Lambda/Amplify.

## License

No `LICENSE` file is committed yet. TravelMaster v1 shipped under MIT — happy to add the same here if that's the intent; let me know and I'll drop in a `LICENSE` file.