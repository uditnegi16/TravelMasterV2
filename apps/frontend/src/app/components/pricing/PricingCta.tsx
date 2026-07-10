import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui/Button";

export function PricingCta() {
  const navigate = useNavigate();

  return (
    <section className="bg-ink py-20 md:py-24">
      <div className="mx-auto flex max-w-[720px] flex-col items-center px-4 text-center md:px-8">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.015em] text-white md:text-3xl">
          Start planning for free today
        </h2>
        <p className="mt-3 max-w-[46ch] text-base text-white/60 md:text-md">
          No credit card, no waitlist — just describe your trip and see what
          TravelMaster builds.
        </p>
        <Button
          variant="secondary"
          size="lg"
          className="mt-8"
          icon={<ArrowRight className="h-[18px] w-[18px]" />}
          iconPosition="right"
          onClick={() => navigate("/chat")}
        >
          Start planning now
        </Button>
      </div>
    </section>
  );
}
