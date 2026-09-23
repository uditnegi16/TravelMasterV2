/**
 * Pure helpers for the admin UI -- kept out of AdminUI.tsx so that file
 * exports only components (keeps Vite fast refresh working).
 */

/** A check that answers but takes longer than this reads as "Slow",
 *  not "Healthy" -- e.g. a 4.7s Supabase round trip. */
export const SLOW_MS = 1000;

export function healthStatus(check: { ok: boolean; latency_ms?: number }): "ok" | "slow" | "down" {
  if (!check.ok) return "down";
  if ((check.latency_ms ?? 0) > SLOW_MS) return "slow";
  return "ok";
}

/** Last `window` days vs the `window` before, from the daily series.
 *  null when there isn't a full previous period to compare against. */
export function periodDelta(values: number[], window = 7) {
  if (values.length < window * 2) return null;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const current = sum(values.slice(-window));
  const previous = sum(values.slice(-window * 2, -window));
  const pct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return { current, previous, pct };
}