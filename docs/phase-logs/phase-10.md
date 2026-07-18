# Phase 10 — Go Aggregation Service: Performance, Reliability, CI/CD

## Phase 10.7 — Performance Benchmarking (k6)

### Objective

Validate the Go aggregation service under increasing concurrent HTTP load and establish baseline production performance metrics.

### Test Environment

- Tool: k6 v2.0.0
- Duration per benchmark: 30 seconds
- Endpoint: `GET /result/{session_id}`
- Response: full aggregated trip (flights, hotels, places, weather, multi-itinerary recommendations, budget analysis) — large JSON payload, ~625 KB/response

### Benchmark 1 — 10 Virtual Users

Configuration: `vus: 10`, `duration: "30s"`

| Metric | Value |
|---|---|
| Requests | 14,723 |
| Throughput | 490.28 req/s |
| Average Latency | 19.97 ms |
| Median | 16.61 ms |
| p90 | 31.48 ms |
| p95 | 39.24 ms |
| Maximum | 156.26 ms |
| Success Rate | 100% |
| Failed Requests | 0 |
| Data Served | 9.2 GB |

Notes: extremely low latency, stable, no failures — excellent baseline.

### Benchmark 2 — 50 Virtual Users

Configuration: `vus: 50`, `duration: "30s"`

| Metric | Value |
|---|---|
| Requests | 29,470 |
| Throughput | 980.87 req/s |
| Average Latency | 49.60 ms |
| Median | 42.97 ms |
| p90 | 88.10 ms |
| p95 | 105.16 ms |
| Maximum | 282.22 ms |
| Success Rate | 100% |
| Failed Requests | 0 |
| Data Served | 18 GB |

Notes: throughput almost doubled, still no failures, latency stayed under 50 ms average — indicates efficient scaling under moderate concurrency.

### Benchmark 3 — 100 Virtual Users

Configuration: `vus: 100`, `duration: "30s"`

| Metric | Value |
|---|---|
| Requests | 22,124 |
| Throughput | 734.01 req/s |
| Average Latency | 133.09 ms |
| Median | 127.13 ms |
| p90 | 216.38 ms |
| p95 | 253.38 ms |
| Maximum | 1.03 sec |
| Success Rate | 100% |
| Failed Requests | 0 |
| Data Served | 14 GB |

Notes: service remained stable, no request failures; latency increased significantly and throughput decreased, indicating resource saturation rather than functional failure.

### Comparative Analysis

| Metric | 10 VUs | 50 VUs | 100 VUs |
|---|---|---|---|
| Requests/sec | 490 | 981 | 734 |
| Avg Latency | 19.97 ms | 49.60 ms | 133.09 ms |
| p95 | 39.24 ms | 105.16 ms | 253.38 ms |
| Errors | 0 | 0 | 0 |
| Success | 100% | 100% | 100% |

### Performance Conclusions

**Scaling behavior**

- 10 → 50 VUs: nearly linear scaling. Throughput doubled with minimal latency impact.
- 50 → 100 VUs: throughput dropped ~25%; latency increased ~2.7×. Indicates CPU, JSON serialization, or network bandwidth became the limiting factor rather than application logic.

**Key findings**

- Peak throughput: 980.87 requests/second.
- Total requests served across all benchmarks: 66,317.
- Total benchmark duration: 90 seconds.
- Total failed requests: 0. Total success rate: 100%.
- Maximum sustained bandwidth observed: approximately 613 MB/s.
- The service demonstrated graceful degradation under load — increased latency, but no functional failures.

**Future optimization opportunities**

- JSON serialization optimization
- Response compression (gzip/Brotli)
- HTTP connection tuning
- Object pooling using `sync.Pool`
- HTTP/2 support
- Horizontal scaling behind a load balancer
- Caching of serialized responses for repeated session requests

---

## Phase 10.9 — Production Reliability

### 10.9.1 — Graceful shutdown

**Problem:** the application exited immediately on Ctrl+C without stopping background goroutines.

**Solution (`main.go`):** added `signal.NotifyContext()` / `context.WithCancel()` / `defer cancel()` to create a root cancellable context. Ctrl+C now begins controlled shutdown. Verified.

### 10.9.2 — Graceful HTTP lifecycle

**Problem:** the HTTP server controlled its own lifecycle (`server.Start()` calling `ListenAndServe()` internally), making graceful shutdown impossible.

**Solution:** refactored `internal/api/server.go` — the `Server` struct now exposes a `Router *http.ServeMux`, routes are registered during `New()`, and `Start()` was removed. `main.go` now owns the `http.Server` instance directly, centralizing lifecycle control. Verified.

### 10.9.3 — Graceful shutdown of all three HTTP servers

Created three independent `http.Server` instances — `apiServer`, `metricsServer`, `pprofServer` — each with `Shutdown(ctx)` called on shutdown. Verified.

### 10.9.4 — Health endpoints

Added `GET /health/live` and `GET /health/ready`, returning `{"status":"UP"}` and `{"status":"READY"}` respectively. Verified.

### 10.9.5 — Configuration validation

**Problem:** invalid ports or broker addresses could crash the service later, mid-run.

**Solution (`internal/config/config.go`):** added `validatePort()` (using `strconv.Atoi`) and `validateBroker()` (using `net.SplitHostPort`). Configuration is now validated at startup. Verified.

### 10.9.6 — Kafka consumer cleanup

Rewrote `internal/kafka/reader.go` to use a `sync.WaitGroup`, `defer wg.Done()`, and `defer reader.Close()`. Consumers now stop cleanly, close their Kafka readers, and the app waits for all of them before exiting. Shutdown sequence: `cancel()` → goroutines exit → `reader.Close()` → `wg.Wait()` → application exits. Verified.

### Errors encountered and resolved

| # | Issue | Resolution |
|---|---|---|
| 1 | `cfg.KafkaBrokers` was a `string`; the Kafka client expected `[]string` | Wrapped as `[]string{cfg.KafkaBrokers}` |
| 2 | `AgentMessage` field mismatch — code used `Data`, struct field was `Value []byte` | Updated `reader.go` to use the correct field |
| 3 | Shutdown appeared incomplete (only some consumers stopped) | Timing issue, not a code bug — retested and confirmed all consumers stop correctly |
| 4 | `failed to dial localhost:9092` | Docker Kafka wasn't running locally — no code bug |
| 5 | `listen tcp :8081/:2112/:6060` already in use | Stale local Go process still running — killed and retested |

---

## Phase 10.10 — CI/CD

### Objective

Every commit automatically validates the Go service: dependency verification, formatting, vetting, tests, build, and a Docker image build.

### What was built

- `.github/workflows/go-aggregator-ci.yml`, created from scratch (the repo had no GitHub Actions before this).
- Pipeline: checkout → setup Go → download dependencies → verify dependencies → format check → `go vet` → tests → build → Docker build (via `docker/build-push-action` with GitHub Actions layer caching).
- Triggers on `push` and `pull_request` to `main` and `develop`.
- `concurrency` control to cancel superseded runs on the same ref (saves CI minutes).
- `timeout-minutes: 15` to guard against a stuck run.
- An informative format-check script that prints offending files before failing, instead of a bare `test -z "$(gofmt -l .)"`.

### Local validation before pushing

- `go mod download` / `go mod verify` — passed
- `gofmt -l .` — initially failed on 11 files; fixed with `gofmt -w .`, retested clean
- `go vet ./...` — passed
- `go test ./... -v` — no test files existed yet at this point (addressed afterward — see below)
- `go build .` — passed

### First live run on GitHub Actions

Verified end-to-end on `uditnegi16/TravelMasterV2` — full pipeline (checkout, Buildx setup, Go setup, module download/verify, format check, vet, tests, build, Docker build) completed successfully in ~2m5s, including unit tests subsequently added for `internal/aggregator`, `internal/api`, and `internal/config`.

---

## Outcome

The Go aggregation service now has:

- Graceful shutdown (application, HTTP, metrics, pprof)
- Validated configuration at startup
- Health endpoints (`/health/live`, `/health/ready`)
- Clean goroutine/Kafka-reader cleanup via `WaitGroup`
- A CI pipeline gating every commit (format, vet, test, build, Docker build)
- A k6-established performance baseline: **980 req/s peak throughput, 66,317 requests / 0 failures across all benchmark runs**
