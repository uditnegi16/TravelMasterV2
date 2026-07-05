import { Ticket, BadgeCheck, ShieldCheck } from "lucide-react";

const points = [
  {
    icon: Ticket,
    title: "Real, bookable results",
    body: "Structured flight and hotel cards with a working link per result — not a raw search-results URL.",
  },
  {
    icon: BadgeCheck,
    title: "Grounded, not invented",
    body: "Answers are backed by live pricing and a curated knowledge layer, so recommendations hold up.",
  },
  {
    icon: ShieldCheck,
    title: "Degrades gracefully",
    body: "If one data source is slow or down, you still get a plan — just without a blank screen.",
  },
];

export function TrustSection() {
  return (
    <section className="bg-surface-subtle py-20 md:py-28">
      <div className="mx-auto max-w-[1120px] px-4 md:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {points.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-white p-6 shadow-soft"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-base leading-relaxed text-ink-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
