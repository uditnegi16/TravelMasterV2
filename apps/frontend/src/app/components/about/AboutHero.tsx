import { Compass } from "lucide-react";

export function AboutHero() {
  return (
    <section className="relative overflow-hidden bg-dot-grid bg-white py-20 md:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-brand-softer via-white to-white" />

      <div className="relative mx-auto max-w-[820px] px-4 text-center md:px-8">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand shadow-soft text-white">
          <Compass className="h-5 w-5" strokeWidth={2.25} />
        </span>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.08em] text-brand">
          About TravelMaster
        </p>

        <h1 className="mt-3 font-display text-4xl font-bold text-ink md:text-5xl">
          Trip planning, spoken in plain language
        </h1>

        <p className="mx-auto mt-5 max-w-[56ch] text-md leading-relaxed text-ink-muted md:text-lg">
          TravelMaster turns a single sentence into a real, bookable
          itinerary — flights, hotels, places, and weather, planned together
          by an AI agent instead of a dozen open tabs.
        </p>
      </div>
    </section>
  );
}
