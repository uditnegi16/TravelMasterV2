import { MessageSquareText, Plane, FileDown, Mic, History, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: MessageSquareText,
    title: "Conversational planning",
    desc: "Plan and revise a trip the same way you'd text a friend who's great at logistics.",
  },
  {
    icon: Plane,
    title: "Real flights & hotels",
    desc: "Every recommendation is checked against live provider data, not guesses.",
  },
  {
    icon: Mic,
    title: "Voice input",
    desc: "Speak your trip instead of typing it — TravelMaster listens and transcribes.",
  },
  {
    icon: FileDown,
    title: "Exportable itineraries",
    desc: "Turn any plan into a clean PDF you can share or take with you offline.",
  },
  {
    icon: History,
    title: "Full chat history",
    desc: "Every trip you've planned stays searchable, so nothing gets lost.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    desc: "Your conversations and payment details are never sold or shared.",
  },
];

export function FeaturesGrid() {
  return (
    <section className="bg-surface-subtle py-16 md:py-20">
      <div className="mx-auto max-w-[1080px] px-4 md:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            Features
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Everything a trip needs, in one place
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card-surface bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <f.icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              <h3 className="mt-4 text-md font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
