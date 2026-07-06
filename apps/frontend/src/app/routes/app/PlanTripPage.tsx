import { useEffect, useMemo, useRef, useState } from "react";

import { generatePdf, planTrip, API_URL } from "../../services/api";
import type { PlanTripResponse, Trip } from "../../models/trip";
import {
  connectProgressSocket,
  waitForSocketOpen,
  type ProgressEvent,
} from "../../../lib/websocket";

import TripResult from "../../components/trip/TripResult";
import PlannerHero from "../../components/planner/PlannerHero";
import PlannerWorkspace from "../../components/planner/PlannerWorkspace";
type PdfStatus = "idle" | "generating" | "ready" | "error";

export default function PlanTripPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanTripResponse | null>(null);
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
              const relativeUrl ="download_url" in event ? event.download_url : null;
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
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unexpected error occurred.";

      setResult({
        error: true,
        message,
      });

      setLoading(false);
      socketRef.current?.close();
    }
  }

  async function handleGeneratePdf(
  sessionId: string,
  trip: Trip,
  ){
    try {
      setPdfStatus("generating");
      await generatePdf(sessionId, trip);
      // Actual "ready"/"error" transition happens via the websocket
      // "pdf" progress events handled in handleSubmit's socket
      // callback above — this call only starts the background task.
    } catch {
      setPdfStatus("error");
      socketRef.current?.close();
    }
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:px-8 lg:py-10">
        <div className="space-y-10 lg:space-y-12">
          <PlannerHero />

          <PlannerWorkspace
            loading={loading}
            currentMessage={currentMessage}
            streamingText={streamingText}
            pdfStatus={pdfStatus}
            pdfUrl={pdfUrl}
            onSubmit={handleSubmit}
          />

          {!loading && (
            <div className="animate-fadeIn">
              <TripResult result={result} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}