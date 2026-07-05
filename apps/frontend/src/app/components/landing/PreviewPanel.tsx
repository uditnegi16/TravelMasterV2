import { Plane, Building2, ThumbsUp } from "lucide-react";
import { Badge } from "../ui/Badge";

const tabs = ["Flights", "Hotels", "Places", "Weather", "Budget", "Itinerary"];

const flights = [
  { airline: "ANA", price: "$612", duration: "10h 25m", stops: "Nonstop" },
  { airline: "JAL", price: "$588", duration: "11h 40m", stops: "Nonstop" },
  { airline: "Emirates", price: "$705", duration: "14h 05m", stops: "1 stop" },
];

export function PreviewPanel() {
  return (
    <div className="relative mx-auto max-w-[880px] rounded-3xl border border-border bg-white p-2 shadow-raised">
      <div className="rounded-[1.25rem] border border-border bg-surface-subtle p-5 md:p-7">
        {/* user turn */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-faint">
            You
          </span>
          <p className="text-sm text-ink-muted md:text-base">
            5 days in Tokyo in November, mid-range budget, flying from Delhi
          </p>
        </div>

        {/* AI response */}
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-brand">
              TravelMaster
            </span>
            <p className="text-sm leading-relaxed text-ink md:text-base">
              November is a great call — cooler weather and the autumn
              foliage is near its peak. I found three direct-friendly flight
              options from Delhi and matched hotels near Shinjuku that fit a
              mid-range budget. Here's what I've got so far.
            </p>
          </div>

          {/* tab pills */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 pl-0 md:pl-8">
            {tabs.map((tab, i) => (
              <span
                key={tab}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                  i === 0
                    ? "bg-ink text-white"
                    : "bg-white text-ink-muted border border-border"
                }`}
              >
                {tab}
              </span>
            ))}
          </div>

          {/* mini flight cards */}
          <div className="mt-4 flex gap-3 overflow-x-auto pl-0 pb-1 md:pl-8 rail-scroll">
            {flights.map((f) => (
              <div
                key={f.airline}
                className="flex w-[220px] shrink-0 flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-soft"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Plane className="h-4 w-4" strokeWidth={2} />
                  </span>
                  {f.stops === "Nonstop" && (
                    <Badge tone="green" dot>
                      Nonstop
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{f.airline}</p>
                  <p className="font-mono text-xs text-ink-faint mt-0.5">{f.duration}</p>
                </div>
                <p className="font-mono text-xl font-semibold text-ink">{f.price}</p>
              </div>
            ))}

            <div className="flex w-[220px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong bg-surface-subtle p-4 text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-ink-faint">
                <Building2 className="h-4 w-4" strokeWidth={2} />
              </span>
              <p className="text-xs font-medium text-ink-faint">
                + hotels, places &amp; a full itinerary
              </p>
            </div>
          </div>

          {/* continued conversation hint */}
          <div className="mt-5 flex items-center gap-2 pl-0 md:pl-8">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-greenSoft text-accent-green">
              <ThumbsUp className="h-3 w-3" strokeWidth={2.25} />
            </span>
            <p className="text-xs text-ink-faint">
              "Can you find something cheaper?" — just keep talking, no restart needed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
