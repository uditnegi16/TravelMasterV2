import { Target, Telescope } from "lucide-react";

export function MissionVision() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-6 px-4 md:grid-cols-2 md:px-8">
        <div className="card-surface p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Target className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold text-ink">
            Our mission
          </h2>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Replace the twenty-tab travel research ritual with one
            conversation. Describe the trip you want, and get a plan built
            from real flight and hotel data — no spreadsheets required.
          </p>
        </div>

        <div className="card-surface p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-tealSoft text-accent-teal">
            <Telescope className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold text-ink">
            Our vision
          </h2>
          <p className="mt-3 leading-relaxed text-ink-muted">
            A travel agent in everyone's pocket — one that remembers your
            preferences, negotiates the logistics, and gets smarter about
            how you like to travel every time you use it.
          </p>
        </div>
      </div>
    </section>
  );
}
