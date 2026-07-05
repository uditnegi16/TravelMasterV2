import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui/Button";
export function CtaBand() {
  const navigate = useNavigate();

  return (
    <section className="bg-ink py-20 md:py-24">
      <div className="mx-auto flex max-w-[820px] flex-col items-center px-4 text-center md:px-8">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.015em] text-white md:text-3xl">
          Your next trip is a sentence away.
        </h2>
        <p className="mt-3 max-w-[46ch] text-base text-white/60 md:text-md">
          Skip the fifteen tabs. Tell TravelMaster what you want and see a
          real plan in seconds.
        </p>
        <Button
          variant="secondary"
          size="lg"
          className="mt-8"
          icon={<ArrowRight className="h-[18px] w-[18px]" />}
          iconPosition="right"
          onClick={() => navigate("/plan")}
        >
          Start planning now
        </Button>
      </div>
    </section>
  );
}
