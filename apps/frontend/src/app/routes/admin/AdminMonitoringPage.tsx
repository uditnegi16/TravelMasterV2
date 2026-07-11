import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { RefreshCw } from "lucide-react";

import AdminLayout from "./AdminLayout";
import { getAdminMonitoring } from "../../services/adminApi";
import type { MonitoringSnapshot } from "../../models/admin";
import { AdminCard, ErrorState, LoadingState, StatCard, StatusPill } from "./components/AdminUI";
import { Button } from "../../components/ui/Button";

export default function AdminMonitoringPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<MonitoringSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in.");
      const result = await getAdminMonitoring(token);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load monitoring data.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cacheTotal = data ? data.cache.hits + data.cache.misses : 0;
  const hitRate = data && cacheTotal > 0 ? Math.round((data.cache.hits / cacheTotal) * 100) : null;

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Monitoring</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Live system health. Auto-refreshes every 30s.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className={refreshing ? "animate-spin" : ""} />}
          onClick={load}
        >
          Refresh
        </Button>
      </div>

      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}

      {data && (
        <>
          <AdminCard className="mb-6">
            <h2 className="mb-4 font-display text-base font-semibold text-ink">
              Dependency checks
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(data.checks).map(([name, check]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                >
                  <div>
                    <p className="font-medium capitalize text-ink">{name}</p>
                    {check.ok ? (
                      <p className="text-xs text-ink-faint">{check.latency_ms}ms</p>
                    ) : (
                      <p className="text-xs text-accent-red">{check.error}</p>
                    )}
                  </div>
                  <StatusPill status={check.ok ? "ok" : "down"} />
                </div>
              ))}
            </div>
          </AdminCard>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Cache hit rate"
              value={hitRate !== null ? `${hitRate}%` : "—"}
              hint={`${data.cache.hits} hits / ${data.cache.misses} misses`}
            />
            <StatCard
              label="Chat turns"
              value={data.chat.success}
              hint={`${data.chat.errors} errors`}
              tone={data.chat.errors > 0 ? "bad" : "good"}
            />
            <StatCard
              label="RAG retrievals"
              value={data.rag.calls}
              hint={`${data.rag.errors} errors`}
              tone={data.rag.errors > 0 ? "bad" : "good"}
            />
            <StatCard
              label="Last updated"
              value={new Date(data.generated_at).toLocaleTimeString()}
            />
          </div>
        </>
      )}
    </AdminLayout>
  );
}
