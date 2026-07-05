import { useEffect, useMemo, useRef, useState } from "react";

import { generatePdf, planTrip, API_URL } from "../../services/api";

import {
  connectProgressSocket,
  waitForSocketOpen,
  type ProgressEvent,
} from "../../../lib/websocket";

import { AiPromptBox } from "../../components/input/AiPromptBox";
import TripResult from "../../components/trip/TripResult";
import AiThinkingLoader from "../../components/loading/AiThinkingLoader";

type PdfStatus = "idle" | "generating" | "ready" | "error";

export default function PlanTripPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  // Phase 5 fix: token events used to be pushed into the same `events`
  // array as progress events. TripProgressTracker only understands
  // `stage`/`status`, so every streamed token rendered as a garbled
  // row. Tokens now accumulate separately into the live response text.
  const [streamingText, setStreamingText] = useState("");

  // Objective 5.4: PDF generation state. Reuses the SAME websocket
  // opened for /plan-trip's progress events — the socket is kept
  // open past the trip result now (see handleSubmit) so it can also
  // receive the "pdf" stage events emitted by /generate-pdf.
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("idle");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  const currentMessage = useMemo(() => {
    if (!events.length)
      return "Understanding your travel request...";

    return (
      events[events.length - 1].message ??
      "Planning your journey..."
    );
  }, [events]);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
    };
  }, []);

  async function handleSubmit(query: string) {
    try {
      setLoading(true);
      setResult(null);
      setEvents([]);
      setStreamingText("");
      setPdfStatus("idle");
      setPdfUrl(null);

      const sessionId = crypto.randomUUID();

      socketRef.current?.close();

      const socket = connectProgressSocket(sessionId, (event) => {
        if (event.type === "progress") {
          if (event.stage === "pdf") {
            // Objective 5.4: pdf stage events are routed here instead
            // of the generic `events` list, so they don't pollute the
            // dev-only stage tracker (same reasoning as the token/
            // progress split from Phase 5's Bug #8 fix).
            if (event.status === "started") {
              setPdfStatus("generating");
            } else if (event.status === "completed") {
              setPdfStatus("ready");
              const relativeUrl = (event as any).download_url ?? null;
              setPdfUrl(relativeUrl ? `${API_URL}${relativeUrl}` : null);
            } else if (event.status === "failed") {
              setPdfStatus("error");
            }
            return;
          }

          setEvents((previous) => [...previous, event]);
        } else if (event.type === "token") {
          setStreamingText((previous) => previous + event.token);
        }
      });

      socketRef.current = socket;

      // Phase 5 fix: wait for the socket handshake to complete before
      // firing the plan-trip request, otherwise the earliest progress
      // events can arrive before the backend has registered this
      // session's connection and get silently dropped.
      await waitForSocketOpen(socket);

      const response = await planTrip(
        query,
        sessionId,
      );

      setResult(response);
      setLoading(false);

      // Objective 5.4: kick off PDF generation once the trip result
      // has actually rendered. Reuses the existing trip data — no
      // new LLM call, no server-side re-fetch. Socket stays open
      // (not closed here) so it can receive the "pdf" stage events.
      if (response && !response.error && response.trip) {
        void handleGeneratePdf(sessionId, response.trip);
      } else {
        socketRef.current?.close();
      }
    } catch (err: any) {
      setResult({
        error: true,
        message: err.message,
      });
      setLoading(false);
      socketRef.current?.close();
    }
  }

  async function handleGeneratePdf(sessionId: string, trip: any) {
    try {
      setPdfStatus("generating");
      await generatePdf(sessionId, trip);
      // Actual "ready"/"error" transition happens via the websocket
      // "pdf" progress events handled in handleSubmit's socket
      // callback above — this call only starts the background task.
    } catch (err) {
      setPdfStatus("error");
      socketRef.current?.close();
    }
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-semibold text-ink">
            Plan Your Trip
          </h1>

          <p className="mt-3 max-w-2xl text-base text-ink-muted">
            Describe your destination, budget and travel style.
            TravelMaster will search flights, hotels,
            attractions and weather, then build your itinerary.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-raised">
          <AiPromptBox
            size="hero"
            onSubmit={handleSubmit}
            placeholder="Example: Plan a 7-day trip to Bali in August under ₹2.5 lakh..."
          />
        </div>

        {loading && (
          <>
            <AiThinkingLoader
              visible={loading}
              message={currentMessage}
            />

            {streamingText && (
              <div className="mt-8 rounded-3xl border border-border bg-white p-6 shadow-soft animate-fadeIn">
                <p className="whitespace-pre-wrap text-sm text-ink-muted">
                  {streamingText}
                  <span className="animate-pulse">▍</span>
                </p>
              </div>
            )}
          </>
        )}

        {!loading && (
          <div className="animate-fadeIn">
            <TripResult result={result} />

            {result && !result.error && (
              <div className="mt-6 rounded-3xl border border-border bg-white p-6 shadow-soft">
                {pdfStatus === "generating" && (
                  <p className="text-sm text-ink-muted">
                    Generating your itinerary PDF...
                  </p>
                )}

                {pdfStatus === "ready" && pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Download Itinerary PDF
                  </a>
                )}

                {pdfStatus === "error" && (
                  <p className="text-sm text-red-600">
                    Couldn&apos;t generate the PDF. You can still view
                    your itinerary above.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}