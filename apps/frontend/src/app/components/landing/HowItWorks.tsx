const steps = [
  {
    number: "01",
    title: "Describe your trip",
    body: "Type or speak it naturally — dates, budget, vibe, number of travelers. No forms, no dropdowns.",
  },
  {
    number: "02",
    title: "AI searches in real time",
    body: "TravelMaster's agent checks live flights, hotels, places, and weather, then ranks what actually fits.",
  },
  {
    number: "03",
    title: "Refine by talking",
    body: "\"Cheaper flights\", \"add Kyoto\", \"swap the hotel\" — the plan updates without starting over.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border bg-white py-20 md:py-28">
      <div className="mx-auto max-w-[1120px] px-4 md:px-8">
        <div className="max-w-[46ch]">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            How it works
          </p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ink md:text-3xl">
            Three steps between you and a finished itinerary.
          </h2>
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <span className="font-mono text-3xl font-semibold text-border-strong">
                {step.number}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-ink-muted">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
