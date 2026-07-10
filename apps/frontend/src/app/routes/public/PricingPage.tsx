import { PricingHero } from "../../components/pricing/PricingHero";
import { PricingPlans } from "../../components/pricing/PricingPlans";
import { ComparisonTable } from "../../components/pricing/ComparisonTable";
import { PricingFaq } from "../../components/pricing/PricingFaq";
import { PricingCta } from "../../components/pricing/PricingCta";

export default function PricingPage() {
  return (
    <div className="bg-white">
      <PricingHero />

      <section className="px-4 pb-20 md:px-8">
        <PricingPlans />
      </section>

      <section className="bg-white px-4 pb-20 md:px-8">
        <div className="mx-auto max-w-[900px] text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            Compare plans
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Full feature breakdown
          </h2>
        </div>
        <div className="mt-10">
          <ComparisonTable />
        </div>
      </section>

      <PricingFaq />
      <PricingCta />
    </div>
  );
}
