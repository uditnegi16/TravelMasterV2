export default function PlannerHero() {
  return (
    <section>
      <div className="max-w-4xl">
        <span className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand">
          AI Trip Planner
        </span>

        <h1 className="mt-5 font-display text-5xl font-bold tracking-[-0.04em] text-ink">
          Plan your next journey.
        </h1>

        <p className="mt-6 max-w-[52ch] text-lg leading-8 text-ink-muted">
          Describe your destination naturally. TravelMaster searches flights,
          hotels, attractions and weather, compares multiple itineraries and
          recommends the best overall trip.
        </p>
      </div>
    </section>
  );
}