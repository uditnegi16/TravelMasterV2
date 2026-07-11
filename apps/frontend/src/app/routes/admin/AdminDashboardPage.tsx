import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

import AdminLayout from "./AdminLayout";
import { getAdminDashboard } from "../../services/adminApi";
import type { AdminDashboard } from "../../models/admin";
import {
  AdminCard,
  BarRow,
  ErrorState,
  LoadingState,
  StatCard,
  StatusPill,
} from "./components/AdminUI";

export default function AdminDashboardPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in.");
        const result = await getAdminDashboard(token);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard.");
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
        <h1 className="font-display text-2xl font-semibold text-ink">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Phase A — Admin Panel overview.
        </p>
      </div>

      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Sessions"
              value={data.analytics.total_sessions}
              hint={`+${data.analytics.new_sessions_in_window} in last ${data.analytics.window_days}d`}
            />
            <StatCard label="Messages" value={data.analytics.total_messages} />
            <StatCard label="Trips generated" value={data.analytics.trips_generated} />
            <StatCard
              label="Open contact requests"
              value={data.open_contact_submissions}
              tone={data.open_contact_submissions > 0 ? "bad" : "good"}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <AdminCard>
              <h2 className="mb-4 font-display text-base font-semibold text-ink">
                System health
              </h2>
              <div className="space-y-3">
                {Object.entries(data.monitoring.checks).map(([name, check]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium capitalize text-ink">{name}</span>
                    <div className="flex items-center gap-3">
                      {check.ok && (
                        <span className="text-xs text-ink-faint">
                          {check.latency_ms}ms
                        </span>
                      )}
                      <StatusPill status={check.ok ? "ok" : "down"} />
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="/admin/monitoring"
                className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
              >
                View full monitoring →
              </Link>
            </AdminCard>

            <AdminCard>
              <h2 className="mb-4 font-display text-base font-semibold text-ink">
                Conversation routing (7d)
              </h2>
              <div className="space-y-2.5">
                {Object.entries(data.analytics.conversation_type_distribution).map(
                  ([label, value]) => (
                    <BarRow
                      key={label}
                      label={label.replace("_", " ")}
                      value={value}
                      max={Math.max(
                        1,
                        ...Object.values(data.analytics.conversation_type_distribution)
                      )}
                    />
                  )
                )}
              </div>
              <Link
                to="/admin/analytics"
                className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
              >
                View full analytics →
              </Link>
            </AdminCard>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
