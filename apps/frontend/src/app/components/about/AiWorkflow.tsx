import { MessageCircle, Brain, Search, MapPinned } from "lucide-react";

const steps = [
  {
    icon: MessageCircle,
    title: "You describe a trip",
    desc: "\u201c5 days in Kyoto, under $1,200, mid-March\u201d",
  },
  {
    icon: Brain,
    title: "The agent plans",
    desc: "Breaks the request into dates, budget, and preferences",
  },
  {
    icon: Search,
    title: "Live data is checked",
    desc: "Flights, hotels, weather, and places are queried in real time",
  },
  {
    icon: MapPinned,
    title: "A plan comes back",
    desc: "A complete itinerary, ready to refine or export",
  },
];

export function AiWorkflow() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-[1080px] px-4 md:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            From a sentence to an itinerary
          </h2>
        </div>

        <div className="relative mt-14">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-border md:block" />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-6">
            {steps.map((step, i) => (
              <div key={step.title} className="relative flex flex-col items-center text-center">
                <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-card">
                  <step.icon className="h-5 w-5" strokeWidth={2.25} />
                </span>

                <span className="mt-4 font-mono text-xs text-ink-faint">
                  Step {i + 1}
                </span>

                <h3 className="mt-1.5 text-md font-semibold text-ink">
                  {step.title}
                </h3>

                <p className="mt-2 max-w-[24ch] text-sm leading-relaxed text-ink-muted">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
