const faqs = [
  {
    q: "Do I need an account?",
    a: "No. You can start planning immediately.",
  },
  {
    q: "Are flight prices live?",
    a: "TravelMaster searches real travel providers before building recommendations.",
  },
  {
    q: "Can I modify a generated trip?",
    a: "Yes. Continue chatting naturally and the itinerary updates.",
  },
  {
    q: "Does it plan hotels too?",
    a: "Flights, hotels, places, weather and itinerary are planned together.",
  },
];

export function FaqSection() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-[900px] px-4 md:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            FAQ
          </p>

          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="mt-12 space-y-5">
          {faqs.map((faq) => (
            <div key={faq.q} className="card-surface p-6">
              <h3 className="text-lg font-semibold text-ink">
                {faq.q}
              </h3>

              <p className="mt-3 leading-7 text-ink-muted">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}