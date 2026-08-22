// Go aggregation service benchmark -- tests ONE microservice's read path
// in isolation, not the real end-to-end product. See
// end-to-end-product-test.js for that (a genuinely different thing,
// deliberately kept separate).
//
// Rewritten 2026-08-03 (Issue 12). The previous version hit a single
// hardcoded session_id with 100 VUs for 30s, checking only
// `status === 200` -- meaning every VU read the exact same value from
// the exact same map key the entire run. That's testing Go's map-read
// performance under a single, always-cache-hot key, not realistic
// concurrent traffic across many different sessions.
//
// Requires the target Go service to be started with
// ENABLE_TEST_SEED=true (see internal/api/server.go) -- the setup()
// phase below seeds SEED_COUNT unique sessions via the test-only
// /test/seed endpoint, which is entirely absent from the route table
// otherwise (not just unauthenticated).
//
// Usage:
//   ENABLE_TEST_SEED=true go run . &
//   k6 run apps/backend/go-kafka-consumer/benchmarks/load_test.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8081";
const SEED_COUNT = 200;

const notFoundCount = new Counter("unexpected_404s");

export const options = {
  scenarios: {
    // Sudden spike, then stop -- does the service degrade gracefully
    // under a sharp burst, or fall over?
    burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: 100 },
        { duration: "10s", target: 100 },
        { duration: "5s", target: 0 },
      ],
      exec: "readTrip",
      startTime: "0s",
    },
    // Sustained, moderate load over a longer window -- does latency
    // stay flat, or creep up under prolonged pressure (a leak, lock
    // contention, GC pressure the burst test is too short to reveal)?
    soak: {
      executor: "constant-vus",
      vus: 25,
      duration: "60s",
      exec: "readTrip",
      startTime: "25s",
    },
    // Load, then silence, then a final small check -- confirms the
    // service actually recovers to baseline latency rather than
    // staying degraded after load stops.
    recovery: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: 80 },
        { duration: "5s", target: 0 },
        { duration: "10s", target: 0 },
        { duration: "5s", target: 10 },
      ],
      exec: "readTrip",
      startTime: "90s",
    },
  },
  thresholds: {
    http_req_duration: ["p(50)<50", "p(95)<200", "p(99)<500"],
    http_req_failed: ["rate<0.01"],
    unexpected_404s: ["count<1"],
  },
};

export function setup() {
  const sessionIds = [];
  for (let i = 0; i < SEED_COUNT; i++) {
    const sessionId = `bench-${i}-${Date.now()}`;
    const res = http.post(
      `${BASE_URL}/test/seed`,
      JSON.stringify({
        session_id: sessionId,
        flight: { airline: "IndiGo", price: 4500 + i },
        hotels: { name: "Test Hotel" },
        places: { count: 5 },
        weather: { temp_c: 27.5 },
      }),
      { headers: { "Content-Type": "application/json" } },
    );

    if (res.status !== 201) {
      throw new Error(
        `Seeding failed (status ${res.status}) -- is the target running with ENABLE_TEST_SEED=true?`,
      );
    }
    sessionIds.push(sessionId);
  }
  return { sessionIds };
}

export function readTrip(data) {
  const sessionId =
    data.sessionIds[Math.floor(Math.random() * data.sessionIds.length)];

  const res = http.get(`${BASE_URL}/result/${sessionId}`);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "session_id in response matches request": (r) => {
      try {
        return JSON.parse(r.body).session_id === sessionId;
      } catch {
        return false;
      }
    },
  });

  if (!ok && res.status === 404) {
    notFoundCount.add(1);
  }

  sleep(0.1);
}
