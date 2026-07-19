# TravelMaster V2 — Local Demo & Interview Prep Guide

Two purposes for this doc:
1. **Part 1** — exact commands to spin up the whole stack locally (including the Kafka + Go path), so you can demo it live in an interview without paying for AWS.
2. **Part 2** — a review sheet of every architectural decision made, framed as the questions an interviewer would actually ask. Use this instead of re-reading the whole chat transcript the night before.

> This file lives in the repo intentionally, as a durable reference — not something you have to dig up from an old chat log before an interview.

---

## Part 1 — Run everything locally

### Prerequisites (one-time setup)

```bash
# Check versions
python --version    # need 3.12
node --version       # need 18+
go version           # need 1.24+
docker --version     # any recent version

# Python package manager
pip install uv
```

You'll need, at minimum, free-tier keys for: Groq, Duffel (sandbox), OpenTripMap, Supabase, Clerk. Hotels (Nominatim) and weather (Open-Meteo) need no key.

---

### Terminal 1 — Kafka (local broker + UI)

```bash
cd TravelMasterV2
docker compose -f infra/kafka/docker-compose.yml up -d
```

Verify it's up:

```bash
docker ps
# should show a kafka container and a kafka-ui container

# open in browser:
# http://localhost:8080   ← Kafka UI, browse topics/messages here live during a demo
```

To tear it down later:

```bash
docker compose -f infra/kafka/docker-compose.yml down
```

---

### Terminal 2 — Go Aggregation Service

```bash
cd apps/backend/go-kafka-consumer
go mod download
go run .
```

You should see the config dump print, then it starts listening. Verify:

```bash
curl http://localhost:8081/health/live
curl http://localhost:8081/health/ready
curl http://localhost:2112/metrics | head -30    # Prometheus metrics
```

**Run the full CI check suite locally** (good to run right before an interview, so you can say "still green" with confidence):

```bash
gofmt -l .
go vet ./...
go test ./... -v -race
go build .
```

**Re-run the load test** (needs [k6](https://k6.io/docs/get-started/installation/) installed):

```bash
k6 run benchmarks/load_test.js
```

---

### Terminal 3 — Agent Service (LangGraph)

**Option A — direct mode (default, no Kafka):**

```bash
cd apps/backend/agent_service
# .env with DUFFEL_API_TOKEN, OPENTRIPMAP_API_KEY, GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# AGENT_BUS=direct  (or just omit it — direct is the default)

uv venv
source .venv/bin/activate      # .venv\Scripts\activate on Windows
uv pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

**Option B — Kafka mode (to demo the event-driven path):**

```bash
cd apps/backend/agent_service
export AGENT_BUS=kafka
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092
uvicorn main:app --reload --port 8001
```

With this mode running, plan a trip through the frontend (or `curl` the endpoint directly) and watch messages land on `travelguru.agents.*` topics in Kafka UI (`localhost:8080`) in real time — this is your strongest live-demo moment. Then show `GET http://localhost:8081/result/{session_id}` on the Go service actually returning the aggregated result.

---

### Terminal 4 — MLOps Backend

```bash
cd apps/backend/mlops_service
# .env from .env.example — Supabase, Clerk, Redis, Razorpay keys
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

### Terminal 5 — Frontend

```bash
cd apps/frontend
# .env: VITE_API_BASE=http://127.0.0.1:8000, VITE_CLERK_PUBLISHABLE_KEY=..., VITE_RAZORPAY_KEY_ID=...
npm install
npm run dev
```

Open `http://localhost:5173`.

---

### Full demo sequence (suggested order, ~5 minutes)

1. `docker compose up` for Kafka → show Kafka UI empty.
2. Start Go service → `curl /health/live` → show it's green.
3. Start agent service in `AGENT_BUS=kafka` mode.
4. Plan a trip from the frontend.
5. Flip back to Kafka UI → show messages landing on the four topics live.
6. `curl http://localhost:8081/result/{session_id}` → show the aggregated JSON.
7. `go test ./... -v -race` in another terminal → show it passing.
8. Open the GitHub Actions tab → show the green CI run.
9. (Optional, if you have k6 installed) run the load test live and narrate the 10/50/100 VU numbers.

---

## Part 2 — Interview review sheet

Read through these once. If you can answer each without looking, you're ready.

### "Why did you add Kafka at all? Wasn't the direct pipeline working?"
The direct in-process path (agents run via a `ThreadPoolExecutor`, results merged synchronously) works fine and is still the default. Kafka is an **optional, toggled alternative** (`AGENT_BUS=direct|kafka`) for a specific problem class: decoupling agent execution from the request lifecycle, enabling replay of any session's raw agent output for debugging, and giving each agent an independently observable, independently scalable consumer. It's an architectural option demonstrated end-to-end, not a replacement forced into production.

### "Why build a separate Go service instead of just scaling the Python consumer you already had?"
Two different jobs. The Python consumer (`kafka_bus/consumer.py`) is a per-request, ephemeral, synchronous consumer group — good for "wait for this one session's results." The Go service is a long-running, always-listening aggregator meant to be benchmarked and scaled independently of the Python service's request/response cycle — a different concurrency model (goroutines + channels vs. Python's GIL-bound threads) better suited to sustained high-throughput consumption. Building it in Go was also a deliberate choice to demonstrate range beyond the Python stack.

### "Walk me through the graceful shutdown."
`main.go` creates a root cancellable context via `signal.NotifyContext`/`context.WithCancel`. On Ctrl+C or SIGTERM, that context cancels. Three independent `http.Server` instances (API, Prometheus metrics, pprof) each get `Shutdown(ctx)` called. Kafka consumer goroutines each hold a `sync.WaitGroup` reference — `main.go` calls `wg.Wait()` before exiting, so the process doesn't terminate until every consumer has closed its reader cleanly. Sequence: `cancel()` → goroutines see `ctx.Done()` → each closes its Kafka reader and calls `wg.Done()` → `wg.Wait()` unblocks → process exits.

### "What bugs did you actually find and fix, not just features you added?"
- A Docker build-context bug in the CI workflow: `docker/build-push-action`'s `context: .` resolved to the repo root (since `uses:` steps aren't affected by `defaults.run.working-directory`), but the Dockerfile's `COPY go.mod go.sum ./` expected the build context to be the service subdirectory. Would have failed on the very first CI run. Fixed by scoping `context:` to the service folder.
- The Alpine runtime image ran as root by default — added a non-root `USER app` in the Dockerfile.
- An 18MB Windows `.exe` binary was sitting untracked in the repo because there was no `.gitignore` for the Go service — added one.

### "How did you actually verify the tests pass, not just that they compile?"
Installed Go 1.24 (matching `go.mod`'s pinned version) and ran the real test suite with `go test ./... -v -race`, including the race detector. One tricky bit: `internal/config`'s validation functions call `log.Fatal` on bad input, which would `os.Exit` and kill the whole test binary if called directly — so those specific test cases re-invoke the test binary as a subprocess (the standard Go `TestHelperProcess` re-exec pattern) and assert on the subprocess's exit code instead, so a fatal exit is captured as a pass/fail signal rather than crashing the real test run.

### "What are the two independent deployment axes, and why keep them separate?"
1. **How agents run** — direct in-process vs. Kafka-mediated (a code/architecture decision).
2. **Where the agent service runs** — AWS Lambda (serverless, per-invocation scaling, the default) vs. Kubernetes (HPA, 2–8 replicas, for steady-state load). Same container, two entrypoints (`lambda_handler.py` vs. `Dockerfile.k8s` running `uvicorn` directly).

Keeping these separate means you can reason about "is this expensive because of Kafka?" and "is this expensive because of the compute target?" independently — which is exactly the distinction that mattered for the cost conversation below.

### "Is any of this actually running in production on AWS right now?"
No — and be ready to say that plainly, with the reasoning, not defensively. The Lambda + direct-mode path is live (serverless, near-zero cost at low traffic). The Kafka + Go aggregation path is fully built, CI-tested, and load-tested, but deliberately **not deployed to AWS**, because Kafka is a stateful, always-listening service — Amazon MSK Serverless alone costs a flat ~$0.75/cluster-hour (~$550/month) regardless of traffic, which contradicts a pay-per-use goal for a portfolio project. The cheapest real option (a single self-hosted EC2 instance running Kafka in KRaft mode) is still a fixed ~$10–17/month whether or not anyone visits the site. This was a deliberate cost-engineering call, not a limitation — good story: "I built and validated the scale path, and made the call not to pay for 24/7 infrastructure a portfolio project doesn't need."

### "What's the load test methodology, and what do the numbers actually mean?"
k6, three runs at 10/50/100 concurrent virtual users, 30 seconds each, hitting `GET /result/{session_id}` (a ~625KB aggregated trip payload). Peak throughput 980 req/s at 50 VUs; 66,317 total requests across all runs with 0 failures. 10→50 VUs scaled nearly linearly (throughput doubled, latency barely moved). 50→100 VUs showed throughput *drop* ~25% and p95 latency rise ~2.7× — that's the signal the service became CPU/serialization-bound rather than failing outright, which is the "graceful degradation" story, not a failure story. Be ready to name the next optimization steps if asked: response compression, `sync.Pool` for allocation reuse, HTTP/2, caching repeated-session responses.

### "What don't you have test coverage for?"
`internal/kafka/reader.go` (needs a real or mocked broker — not unit-tested) and `main.go` itself (wiring/integration, not unit-testable in isolation). Fine to say this plainly if asked — knowing your coverage gaps is itself a good signal.

### "What's still using the free/open providers instead of paid ones, and why?"
Flights: Duffel (sandbox). Hotels: OpenStreetMap Nominatim. Places: OpenTripMap. Weather: Open-Meteo. Voice: local `faster-whisper` (no external API call at all). Deliberate cost-consciousness for a self-funded portfolio project — same reasoning thread as the AWS/Kafka cost decision above. Good to connect these two answers if asked about either.

---

## One honesty note for the interview itself

Be ready to be specific about what you built yourself versus what was AI-assisted in this particular hardening/CI/README pass. You don't need to volunteer it unprompted, but if asked "how did you build this," answer accurately — own the architecture and the decisions (which are yours), and be straightforward that some of the polish (test-writing, the CI bug fix, the README rewrite) was done with AI pairing. Interviewers care much more about whether you understand *why* something exists than whether you typed every character of it.
