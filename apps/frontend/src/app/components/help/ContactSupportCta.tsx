import { useNavigate } from "react-router-dom";
import { LifeBuoy, ArrowRight } from "lucide-react";
import { Button } from "../ui/Button";

export function ContactSupportCta() {
  const navigate = useNavigate();

  return (
    <div className="card-surface flex flex-col items-center gap-5 bg-brand-softer p-10 text-center md:flex-row md:justify-between md:text-left">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-soft">
          <LifeBuoy className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div>
          <p className="text-md font-semibold text-ink">
            Still stuck? We're happy to help.
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Reach the TravelMaster team directly and we'll sort it out.
          </p>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        icon={<ArrowRight className="h-4 w-4" />}
        iconPosition="right"
        onClick={() => navigate("/contact")}
        className="shrink-0"
      >
        Contact support
      </Button>
    </div>
  );
}
