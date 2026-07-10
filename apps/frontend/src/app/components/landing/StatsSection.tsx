import {
  Plane,
  Hotel,
  MapPinned,
  Sparkles,
} from "lucide-react";

const stats = [
  {
    icon: Plane,
    value: "Live",
    label: "Flight search",
  },
  {
    icon: Hotel,
    value: "Hotels",
    label: "Optimized stays",
  },
  {
    icon: MapPinned,
    value: "Places",
    label: "Curated attractions",
  },
  {
    icon: Sparkles,
    value: "AI",
    label: "Personalized itinerary",
  },
];

export function StatsSection() {
  return (
    <section className="border-y border-border bg-surface-subtle">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-5 px-4 py-8 md:grid-cols-4 md:px-8">
        {stats.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="card-surface flex items-center gap-4 p-5"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Icon className="h-6 w-6" strokeWidth={2} />
            </div>

            <div>
              <p className="text-lg font-bold text-ink">{value}</p>
              <p className="text-sm text-ink-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}