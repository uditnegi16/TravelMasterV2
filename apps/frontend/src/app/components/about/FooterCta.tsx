import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "../ui/Button";

export function FooterCta() {
  const navigate = useNavigate();

  return (
    <section className="bg-ink py-20 md:py-24">
      <div className="mx-auto flex max-w-[820px] flex-col items-center px-4 text-center md:px-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
          <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
        </span>

        <h2 className="mt-6 font-display text-2xl font-semibold tracking-[-0.015em] text-white md:text-3xl">
          Ready to plan your next trip?
        </h2>

        <p className="mt-3 max-w-[46ch] text-base text-white/60 md:text-md">
          No account required to start — just tell TravelMaster where you
          want to go.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            size="lg"
            icon={<ArrowRight className="h-[18px] w-[18px]" />}
            iconPosition="right"
            onClick={() => navigate("/chat")}
          >
            Start planning
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5 hover:text-white"
            onClick={() => navigate("/contact")}
          >
            Contact us
          </Button>
        </div>
      </div>
    </section>
  );
}
