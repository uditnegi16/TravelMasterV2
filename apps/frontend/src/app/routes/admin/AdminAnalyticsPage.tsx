import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

import AdminLayout from "./AdminLayout";
import { getAdminAnalytics } from "../../services/adminApi";
import type { AnalyticsOverview } from "../../models/admin";
import { AdminCard, BarRow, ErrorState, LoadingState, StatCard } from "./components/AdminUI";

const WINDOWS = [7, 14, 30];

export default function AdminAnalyticsPage() {
  const { getToken } = useAuth();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in.");
        const result = await getAdminAnalytics(token, days);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, days]);

  const dayEntries = data ? Object.entries(data.user_messages_by_day) : [];
  const maxDayValue = Math.max(1, ...dayEntries.map(([, v]) => v));

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Analytics</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Product usage — sessions, messages, trips.
          </p>
        </div>
        <div className="flex gap-1.5 rounded-xl bg-surface-subtle p-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                days === w ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total sessions" value={data.total_sessions} />
            <StatCard
              label={`New sessions (${data.window_days}d)`}
              value={data.new_sessions_in_window}
            />
            <StatCard label="Total messages" value={data.total_messages} />
            <StatCard label="Trips generated" value={data.trips_generated} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <AdminCard>
              <h2 className="mb-4 font-display text-base font-semibold text-ink">
                User messages per day
              </h2>
              {dayEntries.length === 0 ? (
                <p className="text-sm text-ink-faint">No activity in this window.</p>
              ) : (
                <div className="space-y-2.5">
                  {dayEntries.map(([day, value]) => (
                    <BarRow key={day} label={day} value={value} max={maxDayValue} />
                  ))}
                </div>
              )}
            </AdminCard>

            <AdminCard>
              <h2 className="mb-4 font-display text-base font-semibold text-ink">
                Conversation type distribution
              </h2>
              <div className="space-y-2.5">
                {Object.entries(data.conversation_type_distribution).map(
                  ([label, value]) => (
                    <BarRow
                      key={label}
                      label={label.replace("_", " ")}
                      value={value}
                      max={Math.max(1, ...Object.values(data.conversation_type_distribution))}
                      color="bg-accent-teal"
                    />
                  )
                )}
              </div>
              <p className="mt-3 text-xs text-ink-faint">
                All-time counters, not scoped to the selected window.
              </p>
            </AdminCard>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
