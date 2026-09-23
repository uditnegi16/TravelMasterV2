import { useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../../../lib/cn";
import { periodDelta } from "./adminMetrics";
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
        "rounded-2xl border border-border bg-surface-raised p-5 shadow-soft",
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
  status: "new" | "in_progress" | "resolved" | "ok" | "slow" | "down";
}) {
  const styles: Record<string, string> = {
    new: "bg-accent-amberSoft text-accent-amber",
    in_progress: "bg-brand-soft text-brand",
    resolved: "bg-accent-greenSoft text-accent-green",
    ok: "bg-accent-greenSoft text-accent-green",
    slow: "bg-accent-amberSoft text-accent-amber",
    down: "bg-accent-redSoft text-accent-red",
  };

  const labels: Record<string, string> = {
    new: "New",
    in_progress: "In progress",
    resolved: "Resolved",
    ok: "Healthy",
    slow: "Slow",
    down: "Down",
  };

  // Health states carry an icon as well as color + label, so the state
  // never depends on color alone.
  const Icon =
    status === "ok" ? CheckCircle2 : status === "slow" ? AlertTriangle : status === "down" ? XCircle : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[status]
      )}
    >
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
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

/* ------------------------------------------------------------------ */
/* Sparkline + trend tile                                              */
/* ------------------------------------------------------------------ */

function fmtUtcDay(iso: string) {
  // Buckets are UTC days; format in UTC so a bar never shifts a day.
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Daily bars, oldest -> today. Past days in the de-emphasis step of the
 * brand hue, today in full brand (the "current period" accent). Thin
 * bars, 2px gaps, baseline-anchored, a 2px stub for zero so every day
 * is visible. Hover (or arrow keys when focused) shows one readout;
 * a visually hidden table carries every value for screen readers.
 */
export function Sparkline({
  dates,
  values,
  unit,
  label,
}: {
  dates: string[];
  values: number[];
  /** Singular noun for the readout, e.g. "session". */
  unit: string;
  /** What the series is, e.g. "New sessions per day". */
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const n = values.length;
  if (n === 0) return null;
  const max = Math.max(1, ...values);
  const last = n - 1;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    setActive((cur) => {
      const at = cur ?? last;
      if (e.key === "Home") return 0;
      if (e.key === "End") return last;
      return Math.min(last, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)));
    });
  }

  const plural = (v: number) => `${v.toLocaleString()} ${unit}${v === 1 ? "" : "s"}`;
  // Keep the readout inside the tile at the edges.
  const align =
    active === null ? "" : active < 2 ? "translate-x-0" : active > n - 3 ? "-translate-x-full" : "-translate-x-1/2";

  return (
    <div className="relative mt-4">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${label}, last ${n} days. Use arrow keys to read each day.`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((cur) => cur ?? last)}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        className="focus-ring flex h-10 items-end gap-[2px] rounded-sm"
      >
        {values.map((v, i) => {
          const isToday = i === last;
          const isActive = active === i;
          return (
            // The whole column is the hit target, not just the bar.
            <div
              key={dates[i] ?? i}
              aria-hidden="true"
              onPointerEnter={() => setActive(i)}
              className="flex h-full flex-1 items-end"
            >
              <div
                className={cn(
                  "w-full rounded-t-[2px] transition-colors",
                  v === 0
                    ? "bg-border"
                    : isActive || isToday
                      ? "bg-brand"
                      : active !== null
                        ? "bg-brand/20"
                        : "bg-brand/35",
                )}
                style={{ height: v === 0 ? "2px" : `${Math.max(10, (v / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>

      {active !== null && (
        <div
          role="status"
          className={cn(
            "pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-xs shadow-raised",
            align,
          )}
          style={{ left: `${((active + 0.5) / n) * 100}%` }}
        >
          <span className="font-semibold text-ink">{plural(values[active])}</span>
          <span className="text-ink-muted"> · {fmtUtcDay(dates[active])}</span>
        </div>
      )}

      <div className="mt-1 flex justify-between text-[10px] text-ink-faint" aria-hidden="true">
        <span>{fmtUtcDay(dates[0])}</span>
        <span>Today</span>
      </div>

      {/* Table view: the same numbers without the chart. */}
      <table className="sr-only">
        <caption>{label} (UTC days)</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{unit}s</th>
          </tr>
        </thead>
        <tbody>
          {values.map((v, i) => (
            <tr key={dates[i] ?? i}>
              <td>{fmtUtcDay(dates[i])}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Stat tile contract: label · value · delta vs a named period · trend.
 * Up is good for every series this dashboard shows (more sessions,
 * messages, trips), so up = green ▲, down = red ▼ -- arrow + sign +
 * text, never color alone.
 */
export function TrendTile({
  label,
  value,
  series,
  loading = false,
}: {
  label: string;
  value: number;
  series?: { dates: string[]; values: number[]; unit: string; label: string } | null;
  loading?: boolean;
}) {
  const delta = series ? periodDelta(series.values) : null;

  let deltaEl: ReactNode = null;
  if (delta) {
    if (delta.pct === null) {
      deltaEl = (
        <span className="text-ink-muted">
          {delta.current > 0 ? `${delta.current.toLocaleString()} this week · none the week before` : "No activity in 14 days"}
        </span>
      );
    } else {
      const up = delta.pct > 0;
      const flat = delta.pct === 0;
      deltaEl = (
        <>
          <span
            className={cn(
              "font-semibold",
              flat ? "text-ink-muted" : up ? "text-accent-green" : "text-accent-red",
            )}
          >
            {flat ? "– 0%" : `${up ? "▲ +" : "▼ "}${delta.pct}%`}
          </span>
          <span className="text-ink-faint"> vs previous 7 days</span>
        </>
      );
    }
  }

  return (
    <AdminCard>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-ink">{value.toLocaleString()}</p>
      <p className="mt-1 min-h-[1rem] text-xs">{deltaEl}</p>
      {series ? (
        <Sparkline dates={series.dates} values={series.values} unit={series.unit} label={series.label} />
      ) : loading ? (
        <div aria-hidden="true" className="mt-4 h-10 animate-pulse rounded bg-surface-sunken" />
      ) : null}
    </AdminCard>
  );
}