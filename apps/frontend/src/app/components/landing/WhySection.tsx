import {
  Bot,
  Wallet,
  Route,
  RefreshCcw,
  ShieldCheck,
  BrainCircuit,
} from "lucide-react";

const features = [
  {
    icon: BrainCircuit,
    title: "AI Planning Engine",
    body: "TravelMaster understands your intent and creates a complete trip instead of returning search results.",
  },
  {
    icon: Route,
    title: "Multi-Itinerary",
    body: "Compare Budget, Best Value and Luxury plans before making a decision.",
  },
  {
    icon: Wallet,
    title: "Budget Aware",
    body: "Flights, hotels and itinerary are optimized together to fit your budget.",
  },
  {
    icon: RefreshCcw,
    title: "Continuous Planning",
    body: "Ask for changes naturally without restarting your planning session.",
  },
  {
    icon: ShieldCheck,
    title: "Reliable Recommendations",
    body: "Recommendations are generated from live travel data and grounded knowledge.",
  },
  {
    icon: Bot,
    title: "One Conversation",
    body: "Flights, hotels, weather, places and itinerary are planned inside a single AI conversation.",
  },
];

export function WhySection() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="max-w-[760px]">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            Why TravelMaster
          </p>

          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
            More than a flight search.
            <br />
            Your AI travel companion.
          </h2>

          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            Traditional travel websites make you search. TravelMaster plans,
            compares, optimizes and explains every recommendation in one place.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="card-surface p-7 transition-all hover:-translate-y-1 hover:shadow-raised"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <Icon className="h-6 w-6" strokeWidth={2} />
              </div>

              <h3 className="mt-6 text-xl font-semibold text-ink">
                {title}
              </h3>

              <p className="mt-3 leading-7 text-ink-muted">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}