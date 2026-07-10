import { MessageCircle } from "lucide-react";

export function ContactHero() {
  return (
    <section className="relative overflow-hidden bg-dot-grid bg-white py-20 md:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-brand-softer via-white to-white" />

      <div className="relative mx-auto max-w-[720px] px-4 text-center md:px-8">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-soft">
          <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
        </span>

        <h1 className="mt-6 font-display text-4xl font-bold text-ink md:text-5xl">
          Let's talk travel
        </h1>

        <p className="mx-auto mt-4 max-w-[46ch] text-md leading-relaxed text-ink-muted">
          Questions, feedback, or a bug to report — the team behind
          TravelMaster reads every message and usually replies within a day.
        </p>
      </div>
    </section>
  );
}
