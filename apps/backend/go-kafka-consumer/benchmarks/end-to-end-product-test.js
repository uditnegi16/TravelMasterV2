// Real end-to-end product load test -- the actual guest trip-planning
// flow (Issue 1), against the real deployed API, not a single
// microservice in isolation. See load_test.js for that (the Go
// aggregator's own read-path benchmark, a genuinely different thing).
//
// New for Issue 12 (2026-08-03), corrected 2026-08-04 after the real
// first run against live production surfaced two genuine issues:
// (1) some template queries lacked explicit dates or used a
// destination ("Sikkim") that doesn't cleanly resolve to a standard
// airport code, causing real Duffel validation failures -- fixed by
// requiring an explicit date and a major, unambiguous city in every
// query; (2) pacing was designed around Groq's requests-per-minute
// limit only, but the real bottleneck was its TOKENS-per-minute limit
// (12000 TPM) -- confirmed directly in CloudWatch logs
// ("Rate limit reached... tokens per minute (TPM): Limit 12000, Used
// 11303, Requested 1886"). Slower rate + a hard concurrency cap
// (maxVUs) below address this; the previous config's rate looked
// conservative in isolation but allowed real 20-30s iterations to
// genuinely overlap in practice.
//
// Real per-request cost at time of writing: ~$0.002 (Groq only --
// Duffel runs in sandbox mode, $0 regardless of volume).
//
// Usage:
//   k6 run -e BASE_URL=https://wg9p6esygl.execute-api.ap-south-1.amazonaws.com/prod \
//     apps/backend/go-kafka-consumer/benchmarks/end-to-end-product-test.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8001";

// A planning turn runs 20-100s; poll well past the worst case.
const ANSWER_TIMEOUT_MS = Number(__ENV.ANSWER_TIMEOUT_MS || 150000);
const POLL_INTERVAL_MS = Number(__ENV.POLL_INTERVAL_MS || 3000);

// Real, varied queries -- every one has an explicit date and sticks
// to well-established major hubs only. The first real run
// (2026-08-04) surfaced genuine Duffel failures for smaller regional
// cities (Guwahati/GAU, a real, correct IATA code -- confirmed by
// checking the app's own city-to-airport lookup table directly)
// because Duffel's sandbox mode relies on individual airlines' own
// sandbox environments, which don't reliably cover less-common
// routes. Restricted to major metros with broad, reliable sandbox
// coverage.
const QUERIES = [
  "Plan a 3-day trip from Delhi to Goa for 2 adults, budget 40000 rupees, departing September 5 2026",
  "Plan a weekend trip from Mumbai to Jaipur for 1 adult, budget 15000 rupees, departing October 10 2026",
  "Plan a 5-day trip from Bangalore to Kochi for a family of 4, budget 80000 rupees, departing October 15 2026",
  "Plan a 4-day trip from Chennai to Hyderabad for 2 adults, budget 30000 rupees, departing November 1 2026",
  "Plan a 3-day trip from Delhi to Mumbai for 3 friends, budget 35000 rupees, departing December 5 2026",
  "Plan a weekend trip from Pune to Goa for a couple, budget 25000 rupees, departing September 20 2026",
  "Plan a 4-day trip from Kolkata to Bangalore for 2 adults, budget 45000 rupees, departing November 12 2026",
  "Plan a 3-day trip from Delhi to Hyderabad for 2 friends, budget 20000 rupees, departing October 3 2026",
];

// Real product-facing metrics -- distinct from the raw HTTP timing k6
// tracks automatically, these isolate specifically how long a guest
// actually waits for their trip plan, the number that matters for UX.
const sessionCreateDuration = new Trend("session_create_duration", true);
const tripPlanDuration = new Trend("trip_plan_duration", true);
const enqueueDuration = new Trend("enqueue_duration", true);

export const options = {
  scenarios: {
    guest_trip_planning: {
      executor: "constant-arrival-rate",
      rate: 3, // requests/minute -- the real first run (2026-08-04) hit
      // Groq's TOKENS-per-minute limit (12000 TPM), not its
      // requests-per-minute limit, because iterations that take
      // 20-30s could genuinely overlap even at a "low" 6/min arrival
      // rate if maxVUs allowed it. Lower rate + tighter maxVUs below
      // both address this.
      timeUnit: "1m",
      duration: "10m", // ~30 total requests at this slower rate
      preAllocatedVUs: 2,
      maxVUs: 3, // hard cap on true concurrency, not just arrival rate
    },
  },
  thresholds: {
    // Real LLM + external API latency is seconds, not milliseconds --
    // these thresholds reflect that, not a mistake.
    session_create_duration: ["p(50)<1000", "p(95)<3000"],
    // Real end-to-end answer time, not enqueue time.
    trip_plan_duration: ["p(50)<60000", "p(95)<120000"],
    enqueue_duration: ["p(95)<5000"],
    http_req_failed: ["rate<0.05"],
  },
};

function uniqueDeviceId() {
  return `k6-guest-${__VU}-${__ITER}-${Date.now()}`;
}

export default function () {
  const deviceId = uniqueDeviceId();
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  // Step 1: create a guest session (Issue 1's no-account path) --
  // this is the real endpoint the landing page's hero box calls.
  const createStart = Date.now();
  const createRes = http.post(
    `${BASE_URL}/chat/sessions`,
    JSON.stringify({ device_id: deviceId, title: query.slice(0, 40) }),
    { headers: { "Content-Type": "application/json" } },
  );
  sessionCreateDuration.add(Date.now() - createStart);

  const sessionOk = check(createRes, {
    "session created (200)": (r) => r.status === 200,
  });

  if (!sessionOk) {
    console.error(`Session creation failed: ${createRes.status} ${createRes.body}`);
    return;
  }

  const sessionId = JSON.parse(createRes.body).id;

  // Step 2: plan the actual trip -- the real endpoint that invokes the
  // 2026-08-28: this used to POST and measure the response time,
  // reporting ~2s and calling it "trip planning". It was measuring the
  // wrong thing. Since the async-worker rework, POST /messages returns
  // immediately with {status: "processing"} and the real answer is
  // delivered over WebSocket -- so that 2s was enqueue latency, and the
  // "response contains assistant message content" check failed every
  // time because the body has no message yet.
  //
  // Enqueue and answer are now measured separately, and the answer is
  // found by polling the messages endpoint until an assistant reply
  // appears. Polling rather than a WebSocket keeps this a plain HTTP
  // test; the cost is up to POLL_INTERVAL_MS of quantisation error,
  // which is noise next to a 20-100s planning turn.
  const enqueueStart = Date.now();
  const planRes = http.post(
    `${BASE_URL}/chat/sessions/${sessionId}/messages`,
    JSON.stringify({ device_id: deviceId, query }),
    {
      headers: { "Content-Type": "application/json" },
      timeout: "45s",
    },
  );
  enqueueDuration.add(Date.now() - enqueueStart);

  const accepted = check(planRes, {
    "message accepted (200)": (r) => r.status === 200,
  });

  if (!accepted) {
    sleep(1);
    return;
  }

  // Poll until the assistant's reply lands, or we give up.
  const answerStart = Date.now();
  let answered = false;

  while (Date.now() - answerStart < ANSWER_TIMEOUT_MS) {
    sleep(POLL_INTERVAL_MS / 1000);

    const messagesRes = http.get(
      `${BASE_URL}/chat/sessions/${sessionId}/messages` +
        `?device_id=${encodeURIComponent(deviceId)}`,
      { timeout: "20s" },
    );

    if (messagesRes.status !== 200) continue;

    try {
      const body = JSON.parse(messagesRes.body);
      const messages = body.messages || [];
      const reply = messages.find(
        (m) => m.role === "assistant" && m.content && m.content.length > 0,
      );
      if (reply) {
        answered = true;
        break;
      }
    } catch {
      // Malformed body -- keep polling rather than failing the run.
    }
  }

  if (answered) {
    // Total wall-clock from sending to a usable answer, which is what a
    // user actually waits.
    tripPlanDuration.add(Date.now() - enqueueStart);
  }

  check(null, {
    "assistant answered within timeout": () => answered,
  });

  sleep(1);
}
