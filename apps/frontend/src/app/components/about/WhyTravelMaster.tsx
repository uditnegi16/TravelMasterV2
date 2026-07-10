import { Check, X } from "lucide-react";

const rows = [
  { label: "Plan a trip by describing it in plain language", old: false, tm: true },
  { label: "Real flight & hotel data, not guesses", old: false, tm: true },
  { label: "One place for flights, hotels, and itinerary", old: false, tm: true },
  { label: "Revise a plan by just continuing the conversation", old: false, tm: true },
  { label: "Export a shareable PDF itinerary", old: false, tm: true },
  { label: "Dozens of open browser tabs", old: true, tm: false },
];

export function WhyTravelMaster() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-[900px] px-4 md:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            Why TravelMaster
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Planning a trip, the old way vs. now
          </h2>
        </div>

        <div className="card-surface mt-12 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border bg-surface-subtle px-6 py-4">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-faint">
              &nbsp;
            </span>
            <span className="w-16 text-center text-xs font-semibold uppercase tracking-[0.06em] text-ink-faint">
              Old way
            </span>
            <span className="w-16 text-center text-xs font-semibold uppercase tracking-[0.06em] text-brand">
              TravelMaster
            </span>
          </div>

          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-4 ${
                i !== rows.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-sm text-ink">{row.label}</span>

              <span className="flex w-16 justify-center">
                {row.old ? (
                  <Check className="h-4 w-4 text-ink-faint" />
                ) : (
                  <X className="h-4 w-4 text-ink-faint" />
                )}
              </span>

              <span className="flex w-16 justify-center">
                {row.tm ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-greenSoft text-accent-green">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-redSoft text-accent-red">
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
