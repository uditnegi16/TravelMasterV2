import type { ReactNode } from "react";
import { cn } from "../../../../lib/cn";

export function AdminCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-white p-5 shadow-soft",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "good" | "bad";
}) {
  return (
    <AdminCard>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-2xl font-semibold text-ink",
          tone === "good" && "text-accent-green",
          tone === "bad" && "text-accent-red"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </AdminCard>
  );
}

export function BarRow({
  label,
  value,
  max,
  color = "bg-brand",
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-xs font-medium text-ink-muted">
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: "new" | "in_progress" | "resolved" | "ok" | "down";
}) {
  const styles: Record<string, string> = {
    new: "bg-accent-amberSoft text-accent-amber",
    in_progress: "bg-brand-soft text-brand",
    resolved: "bg-accent-greenSoft text-accent-green",
    ok: "bg-accent-greenSoft text-accent-green",
    down: "bg-accent-redSoft text-accent-red",
  };

  const labels: Record<string, string> = {
    new: "New",
    in_progress: "In progress",
    resolved: "Resolved",
    ok: "Healthy",
    down: "Down",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-10 text-sm text-ink-faint">
      {message}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10 text-sm text-ink-faint">
      Loading...
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-accent-redSoft bg-accent-redSoft/40 px-4 py-3 text-sm text-accent-red">
      {message}
    </div>
  );
}
