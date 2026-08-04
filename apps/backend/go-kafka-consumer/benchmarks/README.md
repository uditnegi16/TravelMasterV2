# Load Testing

Two genuinely different tests, kept deliberately separate (Issue 12, 2026-08-03):

| | `load_test.js` | `end-to-end-product-test.js` |
|---|---|---|
| Tests | The Go aggregator's `/result/{id}` read path, in isolation | The real guest trip-planning flow, through the real API |
| External API cost | $0 (no LLM/Duffel/OpenTripMap calls at all) | ~$0.002/request (Groq only — Duffel runs in sandbox mode) |
| Realistic traffic | Many unique, pre-seeded sessions | Many unique guests, varied real queries |
| Scenarios | Burst, soak, recovery | Paced constant-arrival-rate (stays under Groq's free-tier rate limit) |

Neither of these existed in a form worth trusting before tonight — the previous script hit one hardcoded session ID with 100 VUs for 30 seconds, checking only `status === 200`. That measures whether a single, always-cache-hot map key can be read fast, which says nothing about real concurrent traffic or the actual product.

## `load_test.js` — Go aggregator microservice benchmark

Requires the target running with the test-only seed endpoint enabled:

```bash
cd apps/backend/go-kafka-consumer
ENABLE_TEST_SEED=true go run .
```

Then, from anywhere:

```bash
k6 run apps/backend/go-kafka-consumer/benchmarks/load_test.js
# or against a different host:
k6 run -e BASE_URL=http://your-host:8081 apps/backend/go-kafka-consumer/benchmarks/load_test.js
```

`setup()` seeds 200 unique sessions via `POST /test/seed` before any read traffic starts — this endpoint is entirely absent from the route table unless `ENABLE_TEST_SEED=true` is set (not just unauthenticated; a genuinely different, safer default for anything resembling a production deploy).

Three scenarios run in sequence: a sharp burst (0→100 VUs in 5s), a 60-second soak at a steady 25 VUs, and a recovery check (load, silence, then a small post-recovery sample) — checking not just "does it work under load" but "does it *stay* fast under sustained load, and *recover* once load stops."

## `end-to-end-product-test.js` — real product test

No seeding needed — every iteration is a genuinely new simulated guest (unique `device_id`, matching Issue 1's real one-trial-per-device design) planning a real trip through the real API, with a query randomly picked from 8 realistically varied requests.

```bash
# Against a local instance:
k6 run apps/backend/go-kafka-consumer/benchmarks/end-to-end-product-test.js

# Against live production:
k6 run -e BASE_URL=https://wg9p6esygl.execute-api.ap-south-1.amazonaws.com/prod \
  apps/backend/go-kafka-consumer/benchmarks/end-to-end-product-test.js
```

**Before running against live production**, know what you're spending: at the current rate (3 requests/minute for 10 minutes ≈ 30 total requests), this costs roughly **$0.06 in Groq API usage total** — trivial, but real. Duffel is sandbox-mode and free regardless of volume.

## Real findings from actually running this (2026-08-04)

The first genuine run against live production surfaced three separate real issues — this is exactly why "realistic" load testing matters; the old fake single-session script could never have found any of these.

**1. Lambda memory exhaustion.** One request's CloudWatch `REPORT` line showed `Max Memory Used: 1024 MB` — its *entire* allocated memory, correlating with hitting the ~29s API Gateway ceiling. **Action needed (can't be done from a zip — `template.yml` is gitignored):** in your local `template.yml`, find `TravelGuruAgentFunction`'s `MemorySize` and bump it from `1024` to `2048`, then `sam build && sam deploy`. Lambda memory is proportional to CPU allocation too, so this should help raw latency, not just headroom.

**2. Groq TPM collisions — real root cause found and fixed in code.** `planner_node.py` and `composer_node.py` both drew from the same `GROQ_API_KEY`, so a single trip-planning request's two heaviest LLM calls competed for the same 12,000-tokens-per-minute budget every time — confirmed directly in CloudWatch (`Rate limit reached... TPM: Limit 12000, Used 11133, Requested 2668`). Fixed by extending the exact pattern `get_classifier_llm()` already used: a new `get_planner_llm()`, using a separate `GROQ_PLANNER_API_KEY` if set. **Optional but recommended:** create a second Groq API key (free) and set `GROQ_PLANNER_API_KEY` in `template.yml` — without it, this is a safe no-op (falls back to the shared key, same as today).

**3. Query pool fixed.** Some queries lacked explicit dates or used a smaller regional city (Guwahati) that Duffel's sandbox doesn't reliably cover — confirmed the app's own city→IATA lookup was correct (`"guwahati": "GAU"`), so this was Duffel's sandbox coverage, not an app bug. Restricted the pool to major hubs with broad, reliable sandbox coverage.

Thresholds are set for what real LLM + multi-provider latency actually looks like — seconds, not milliseconds (`trip_plan_duration` p50 < 15s, p95 < 30s) — not a typo, and not the same expectation as the Go benchmark's sub-second thresholds.
