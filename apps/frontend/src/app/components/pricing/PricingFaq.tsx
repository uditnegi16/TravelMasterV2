import { Accordion } from "../ui/Accordion";

const faqs = [
  {
    id: "billing-cycle",
    question: "When does Premium launch?",
    answer:
      "Premium is in the works. Everyone gets full access to trip planning on the Free plan in the meantime — no waitlist required to start.",
  },
  {
    id: "free-limits",
    question: "Is the Free plan really unlimited?",
    answer:
      "Yes. There's no cap on the number of trips or conversations you can plan on the Free plan today.",
  },
  {
    id: "cancel",
    question: "Can I cancel Premium anytime?",
    answer:
      "Once Premium launches, you'll be able to cancel anytime from your account settings — no long-term commitment.",
  },
  {
    id: "payment-methods",
    question: "What payment methods will be supported?",
    answer:
      "Premium billing is handled through Razorpay, supporting major cards, UPI, and net banking.",
  },
];

export function PricingFaq() {
  return (
    <section className="bg-surface-subtle py-16 md:py-20">
      <div className="mx-auto max-w-[760px] px-4 md:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            FAQ
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Pricing questions
          </h2>
        </div>

        <div className="mt-10">
          <Accordion items={faqs} />
        </div>
      </div>
    </section>
  );
}
