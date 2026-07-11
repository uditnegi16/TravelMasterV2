import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

import AdminLayout from "./AdminLayout";
import {
  listContactSubmissions,
  updateContactSubmissionStatus,
} from "../../services/adminApi";
import type { ContactSubmission } from "../../models/admin";
import {
  AdminCard,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusPill,
} from "./components/AdminUI";

const FILTERS: Array<{ label: string; value: ContactSubmission["status"] | "all" }> = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
];

export default function AdminContactPage() {
  const { getToken } = useAuth();
  const [submissions, setSubmissions] = useState<ContactSubmission[] | null>(null);
  const [filter, setFilter] = useState<ContactSubmission["status"] | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(status: ContactSubmission["status"] | "all") {
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in.");
      const result = await listContactSubmissions(
        token,
        status === "all" ? undefined : status
      );
      setSubmissions(result.submissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions.");
    }
  }

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleStatusChange(
    id: string,
    status: ContactSubmission["status"]
  ) {
    setBusyId(id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in.");
      await updateContactSubmissionStatus(token, id, status);
      setSubmissions((prev) =>
        prev ? prev.map((s) => (s.id === id ? { ...s, status } : s)) : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update submission.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Contact submissions
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Triage messages from the public contact form.
          </p>
        </div>

        <div className="flex gap-1.5 rounded-xl bg-surface-subtle p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                filter === f.value
                  ? "bg-white text-ink shadow-soft"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!submissions && !error && <LoadingState />}
      {submissions && submissions.length === 0 && (
        <EmptyState message="No submissions in this view." />
      )}

      {submissions && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((s) => (
            <AdminCard key={s.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">{s.subject}</p>
                    <StatusPill status={s.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {s.name} · {s.email} ·{" "}
                    {new Date(s.created_at).toLocaleString()}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-ink-muted">
                    {s.message}
                  </p>
                </div>

                <select
                  value={s.status}
                  disabled={busyId === s.id}
                  onChange={(e) =>
                    handleStatusChange(
                      s.id,
                      e.target.value as ContactSubmission["status"]
                    )
                  }
                  className="shrink-0 rounded-lg border border-border bg-white px-2 py-1.5 text-sm font-medium text-ink focus-ring"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
