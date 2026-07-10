import { Sparkles } from "lucide-react";

export function PricingHero() {
  return (
    <section className="relative overflow-hidden bg-dot-grid bg-white py-20 md:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-brand-softer via-white to-white" />

      <div className="relative mx-auto max-w-[680px] px-4 text-center md:px-8">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-soft">
          <Sparkles className="h-5 w-5" strokeWidth={2.25} />
        </span>

        <h1 className="mt-6 font-display text-4xl font-bold text-ink md:text-5xl">
          Simple, honest pricing
        </h1>

        <p className="mx-auto mt-4 max-w-[46ch] text-md leading-relaxed text-ink-muted">
          Start planning for free. Upgrade later if you want more trips,
          faster responses, and priority support.
        </p>
      </div>
    </section>
  );
}
