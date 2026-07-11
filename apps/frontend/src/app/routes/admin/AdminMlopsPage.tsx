import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

import AdminLayout from "./AdminLayout";
import { getAdminMlops } from "../../services/adminApi";
import type { MlopsDashboard } from "../../models/admin";
import { AdminCard, BarRow, ErrorState, LoadingState, StatCard } from "./components/AdminUI";

function LatencyRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-ink">{value}ms</span>
    </div>
  );
}

export default function AdminMlopsPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<MlopsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in.");
        const result = await getAdminMlops(token);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load MLOps dashboard.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">MLOps</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Agent pipeline observability — retrieval, latency, and routing for the
          LangGraph trip-planning graph.
        </p>
      </div>

      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Avg turn latency"
              value={`${data.pipeline_latency.end_to_end_chat_turn.avg_ms}ms`}
              hint={`p95: ${data.pipeline_latency.end_to_end_chat_turn.p95_ms}ms`}
            />
            <StatCard
              label="Avg RAG latency"
              value={`${data.pipeline_latency.rag_retrieval.avg_ms}ms`}
              hint={`${data.retrieval_quality.avg_docs_retrieved ?? "—"} avg docs`}
            />
            <StatCard
              label="Cache hit rate"
              value={
                data.cache.hit_rate !== null
                  ? `${Math.round(data.cache.hit_rate * 100)}%`
                  : "—"
              }
            />
            <StatCard
              label="Error rate"
              value={`${Math.round(data.reliability.error_rate * 100)}%`}
              tone={data.reliability.error_rate > 0.02 ? "bad" : "good"}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <AdminCard>
              <h2 className="mb-2 font-display text-base font-semibold text-ink">
                End-to-end chat turn latency
              </h2>
              <LatencyRow label="Average" value={data.pipeline_latency.end_to_end_chat_turn.avg_ms} />
              <LatencyRow label="p50" value={data.pipeline_latency.end_to_end_chat_turn.p50_ms} />
              <LatencyRow label="p95" value={data.pipeline_latency.end_to_end_chat_turn.p95_ms} />
              <LatencyRow label="Max" value={data.pipeline_latency.end_to_end_chat_turn.max_ms} />
              <p className="mt-2 text-xs text-ink-faint">
                Based on last {data.pipeline_latency.end_to_end_chat_turn.count} recorded turns.
              </p>
            </AdminCard>

            <AdminCard>
              <h2 className="mb-2 font-display text-base font-semibold text-ink">
                RAG retrieval latency
              </h2>
              <LatencyRow label="Average" value={data.pipeline_latency.rag_retrieval.avg_ms} />
              <LatencyRow label="p50" value={data.pipeline_latency.rag_retrieval.p50_ms} />
              <LatencyRow label="p95" value={data.pipeline_latency.rag_retrieval.p95_ms} />
              <LatencyRow label="Max" value={data.pipeline_latency.rag_retrieval.max_ms} />
              <p className="mt-2 text-xs text-ink-faint">
                {data.retrieval_quality.retrieval_calls} calls,{" "}
                {data.retrieval_quality.retrieval_errors} errors.
              </p>
            </AdminCard>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <AdminCard>
              <h2 className="mb-4 font-display text-base font-semibold text-ink">
                Conversation routing
              </h2>
              <div className="space-y-2.5">
                {Object.entries(data.conversation_routing).map(([label, value]) => (
                  <BarRow
                    key={label}
                    label={label.replace("_", " ")}
                    value={value}
                    max={Math.max(1, ...Object.values(data.conversation_routing))}
                    color="bg-accent-teal"
                  />
                ))}
              </div>
            </AdminCard>

            <AdminCard>
              <h2 className="mb-4 font-display text-base font-semibold text-ink">
                Reliability
              </h2>
              <div className="space-y-2.5">
                <BarRow
                  label="Success"
                  value={data.reliability.chat_turn_success}
                  max={Math.max(1, data.reliability.chat_turn_success + data.reliability.chat_turn_errors)}
                  color="bg-accent-green"
                />
                <BarRow
                  label="Errors"
                  value={data.reliability.chat_turn_errors}
                  max={Math.max(1, data.reliability.chat_turn_success + data.reliability.chat_turn_errors)}
                  color="bg-accent-red"
                />
              </div>
            </AdminCard>
          </div>

          <p className="mt-6 text-xs text-ink-faint">{data.note}</p>
        </>
      )}
    </AdminLayout>
  );
}
