import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { ArrowRight, CalendarDays, MessageSquare, Plus, Sparkles } from "lucide-react";

import { getDashboard, type DashboardData, type TripSummary } from "../../services/chatApi";
import { getTierTheme } from "../../components/trip/tripTheme";

/* ------------------------------------------------------------------ */
/* Date + money helpers. Everything shown comes from stored trip data;  */
/* the only thing computed here is "how many days away" and counts.     */
/* ------------------------------------------------------------------ */

function localDate(iso?: string | null): Date | null {
  if (!iso) return null;
  // "2026-10-24" -> local midnight (not UTC, which shifts a day west of UTC)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function daysUntil(iso?: string | null): number | null {
  const d = localDate(iso);
  if (!d) return null;
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday().getTime()) / 86_400_000);
}

function fmtDay(iso?: string | null, withYear = false): string {
  const d = localDate(iso);
  return d
    ? d.toLocaleDateString([], { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) })
    : "";
}

function fmtRange(start?: string | null, end?: string | null): string {
  if (!start) return "";
  if (!end) return fmtDay(start);
  const s = localDate(start);
  const e = localDate(end);
  if (s && e && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString([], { month: "short" })} ${s.getDate()} – ${e.getDate()}`;
  }
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}

function tripDays(t: TripSummary): number | null {
  const s = localDate(t.start_date);
  const e = localDate(t.end_date);
  if (!s || !e) return null;
  const n = Math.round((e.getTime() - s.getTime()) / 86_400_000);
  return n > 0 ? n : null;
}

function inr(value?: number | null): string {
  if (value === null || value === undefined) return "";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function tripName(t: TripSummary): string {
  const dest = t.destination ? titleCase(t.destination) : null;
  const days = tripDays(t);
  if (dest && days) return `${dest}, ${days} day${days > 1 ? "s" : ""}`;
  return dest || t.title || "Untitled trip";
}

type Status = { label: string; tone: "upcoming" | "now" | "past" | "none"; sort: number };

function tripStatus(t: TripSummary): Status {
  const toStart = daysUntil(t.start_date);
  const toEnd = daysUntil(t.end_date ?? t.start_date);
  if (toStart === null) return { label: "No dates", tone: "none", sort: 3 };
  if (toStart > 0) return { label: `Upcoming · ${fmtDay(t.start_date)}`, tone: "upcoming", sort: 1 };
  if (toEnd !== null && toEnd >= 0) return { label: "Happening now", tone: "now", sort: 0 };
  return { label: `Past · ${fmtDay(t.start_date, true)}`, tone: "past", sort: 2 };
}

const STATUS_TONE: Record<Status["tone"], string> = {
  now: "text-accent-green",
  upcoming: "text-brand-text",
  past: "text-ink-faint",
  none: "text-ink-faint",
};

/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Bumped by "Try again" to re-run the fetch effect.
  const [reloadKey, setReloadKey] = useState(0);

  const fetchDashboard = useCallback(async () => {
    // A signed-in user's token can be briefly null while Clerk
    // refreshes it (same transient ChatPage guards against).
    let token: string | null = null;
    for (let i = 0; i < 10 && !token; i++) {
      token = await getToken();
      if (!token) await new Promise((r) => setTimeout(r, 200));
    }
    if (!token) throw new Error("Not signed in");
    return getDashboard(token);
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your dashboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchDashboard, reloadKey]);

  function retry() {
    setError(null);
    setData(null);
    setReloadKey((k) => k + 1);
  }

  const openTrip = (sessionId: string) => navigate("/chat", { state: { openSessionId: sessionId } });
  const planNew = () => navigate("/chat", { state: { newChat: true } });

  const derived = useMemo(() => {
    if (!data) return null;
    const trips = data.trips;
    // Next trip = soonest start date that hasn't ended yet.
    const next =
      trips
        .filter((t) => {
          const toEnd = daysUntil(t.end_date ?? t.start_date);
          return toEnd !== null && toEnd >= 0;
        })
        .sort((a, b) => (daysUntil(a.start_date) ?? 0) - (daysUntil(b.start_date) ?? 0))[0] ?? null;

    const destinations = new Set(
      trips.map((t) => t.destination?.trim().toLowerCase()).filter(Boolean),
    );
    const upcoming = trips.filter((t) => (daysUntil(t.start_date) ?? -1) > 0).length;

    return { next, destinations: destinations.size, upcoming };
  }, [data]);

  const firstName = user?.firstName || user?.username || "traveller";
  const initial = firstName.charAt(0).toUpperCase();

  /* ---------- loading / error ---------- */
  if (error) {
    return (
      <PageShell>
        <div role="alert" className="rounded-2xl border border-border bg-surface-raised p-8 text-center">
          <p className="text-ink">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="focus-ring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface"
          >
            Try again
          </button>
        </div>
      </PageShell>
    );
  }

  if (!data || !derived) {
    return (
      <PageShell>
        <div aria-busy="true" aria-label="Loading your dashboard" className="animate-pulse space-y-6">
          <div className="h-16 w-2/3 rounded-2xl bg-surface-sunken" />
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="h-36 rounded-2xl bg-surface-sunken" />
              <div className="h-64 rounded-2xl bg-surface-sunken" />
            </div>
            <div className="h-72 rounded-2xl bg-surface-sunken" />
          </div>
        </div>
      </PageShell>
    );
  }

  const { quota, plan, trips } = data;
  const isPremium = plan.tier === "premium";
  const usedPct = quota.limit > 0 ? Math.min(100, (quota.used / quota.limit) * 100) : 0;
  const nearLimit = quota.remaining <= 1;
  const visibleTrips = showAll ? trips : trips.slice(0, 5);

  return (
    <PageShell>
      {/* ---------------- Greeting + quota ---------------- */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            <span className="font-semibold text-ink">{isPremium ? plan.name : "Free plan"}</span>
            {" — "}
            {quota.used} of {quota.limit} trip plans used this month
          </p>
          <div
            className="mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-sunken"
            role="progressbar"
            aria-label="Trip plans used this month"
            aria-valuemin={0}
            aria-valuemax={quota.limit}
            aria-valuenow={quota.used}
          >
            <div
              className={`h-full rounded-full ${nearLimit ? "bg-accent-amber" : "bg-brand"}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>

        {user?.imageUrl ? (
          <img src={user.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
            {initial}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* ---------------- Left column ---------------- */}
        <div className="flex min-w-0 flex-col gap-6">
          <CountdownCard trip={derived.next} onOpen={openTrip} onPlan={planNew} />

          <section className="rounded-2xl border border-border bg-surface-raised p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Saved trips</h2>
              {trips.length > 0 && (
                <Link to="/chat" className="focus-ring rounded text-xs font-semibold text-brand-text hover:underline">
                  Open chat <ArrowRight className="inline h-3 w-3" />
                </Link>
              )}
            </div>

            {trips.length === 0 ? (
              <div className="rounded-xl bg-surface-subtle px-4 py-8 text-center">
                <p className="text-sm text-ink-muted">Trips you plan will show up here.</p>
                <button
                  type="button"
                  onClick={planNew}
                  className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface"
                >
                  <Plus className="h-4 w-4" /> Plan your first trip
                </button>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {visibleTrips.map((t, i) => {
                    const theme = getTierTheme(t.profile ?? undefined, i);
                    const status = tripStatus(t);
                    const letter = (t.destination || t.title || "?").trim().charAt(0).toUpperCase();
                    return (
                      <li key={t.session_id}>
                        <button
                          type="button"
                          onClick={() => openTrip(t.session_id)}
                          className="focus-ring group flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition hover:bg-surface-subtle"
                        >
                          <span
                            aria-hidden="true"
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white ${theme.banner}`}
                          >
                            {letter}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {tripName(t)}
                            </span>
                            <span className="mt-0.5 block truncate text-xs">
                              <span className={`font-medium ${STATUS_TONE[status.tone]}`}>{status.label}</span>
                              <span className="text-ink-faint">
                                {[t.profile, inr(t.total_cost)].filter(Boolean).map((x) => ` · ${x}`).join("")}
                              </span>
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {trips.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="focus-ring mt-2 w-full rounded-lg py-2 text-xs font-semibold text-ink-muted hover:bg-surface-subtle hover:text-ink"
                  >
                    {showAll ? "Show fewer" : `Show all ${trips.length} trips`}
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {/* ---------------- Right column ---------------- */}
        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface-raised p-5 shadow-soft">
            <h2 className="mb-2 text-sm font-bold text-ink">Your stats</h2>
            <dl className="divide-y divide-border text-sm">
              <Stat label="Trips planned" value={String(trips.length)} />
              <Stat label="Destinations" value={String(derived.destinations)} />
              <Stat label="Upcoming trips" value={String(derived.upcoming)} />
              <Stat
                label="Plans left this month"
                value={`${quota.remaining} of ${quota.limit}`}
                tone={nearLimit ? "text-accent-amber" : undefined}
              />
              {isPremium && plan.expires_at ? (
                <Stat label="Premium until" value={fmtDay(plan.expires_at, true)} />
              ) : (
                <Stat label="Quota resets" value={fmtDay(quota.resets_at)} />
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-surface-raised p-5 shadow-soft">
            <h2 className="mb-3 text-sm font-bold text-ink">Quick actions</h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={planNew}
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-[#12141c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-[#12141c] dark:hover:bg-white/90"
              >
                <Plus className="h-4 w-4" /> Plan a new trip
              </button>
              <Link
                to="/chat"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand-text transition hover:bg-brand-softer"
              >
                <MessageSquare className="h-4 w-4" /> Chat history
              </Link>
              {!isPremium && (
                <Link
                  to="/pricing"
                  className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-accent-amberSoft px-4 py-2.5 text-sm font-semibold text-accent-amber transition hover:brightness-95"
                >
                  <Sparkles className="h-4 w-4" /> Upgrade to Premium
                </Link>
              )}
            </div>
            {!isPremium && nearLimit && (
              <p className="mt-3 text-xs text-ink-muted">
                {quota.remaining === 0
                  ? `You've used all ${quota.limit} free plans this month.`
                  : "1 free plan left this month."}{" "}
                Premium gives you 100 a month.
              </p>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */

function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`font-semibold tabular-nums ${tone ?? "text-ink"}`}>{value}</dd>
    </div>
  );
}

function CountdownCard({
  trip,
  onOpen,
  onPlan,
}: {
  trip: TripSummary | null;
  onOpen: (id: string) => void;
  onPlan: () => void;
}) {
  const days = trip ? daysUntil(trip.start_date) : null;
  const dest = trip?.destination ? titleCase(trip.destination) : trip?.title ?? "";

  const headline = !trip
    ? "No upcoming trips yet"
    : days !== null && days > 1
      ? `${days} days to ${dest}`
      : days === 1
        ? `Tomorrow: ${dest}`
        : days === 0
          ? `Today: ${dest}`
          : `You're in ${dest}`;

  return (
    // Fixed navy scene (same as the landing hero) in both themes -- it's
    // an illustration, not a surface, so it doesn't follow the tokens.
    <section className="relative overflow-hidden rounded-2xl bg-[#12335c] p-6 text-white shadow-raised">
      <div aria-hidden="true" className="absolute -bottom-6 right-24 h-24 w-56 rounded-t-full bg-[#173a68]" />
      <div aria-hidden="true" className="absolute -bottom-10 -right-6 h-28 w-48 rounded-t-full bg-[#0c2544]" />
      <div aria-hidden="true" className="absolute right-10 top-6 h-10 w-10 rounded-full bg-[#f0997b]/90" />

      <div className="relative max-w-md">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#c7d6ec]">
          <CalendarDays className="h-3.5 w-3.5" />
          {trip ? "Upcoming trip" : "Next adventure"}
        </p>
        {/* Explicit text-white: globals.css sets a grey color on every <p>,
            which beats the white inherited from the card. */}
        <p className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">{headline}</p>
        <p className="mt-1 text-sm text-[#e3e6f2]">
          {trip
            ? [fmtRange(trip.start_date, trip.end_date), trip.profile && `${trip.profile} plan`, inr(trip.total_cost)]
                .filter(Boolean)
                .join(" · ")
            : "Plan a trip with dates and it will count down here."}
        </p>

        <button
          type="button"
          onClick={() => (trip ? onOpen(trip.session_id) : onPlan())}
          className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#ef9f27] px-4 py-2 text-sm font-bold text-[#412402] transition hover:brightness-105"
        >
          {trip ? "Open plan" : "Plan a trip"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}