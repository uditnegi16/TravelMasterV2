import { useNavigate } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { cn } from "../../../lib/cn";

const freeFeatures = [
  "Unlimited AI trip planning conversations",
  "Real flight & hotel search",
  "Voice input",
  "PDF export & trip sharing",
  "Full chat history",
];

const premiumFeatures = [
  "Everything in Free",
  "Priority AI response speed",
  "Multi-city & longer itineraries",
  "Early access to new features",
  "Priority support",
];

export function PricingPlans() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto grid max-w-[900px] grid-cols-1 gap-6 md:grid-cols-2">
      {/* Free plan */}
      <div className="card-surface flex flex-col p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.06em] text-ink-faint">
          Free
        </p>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-bold text-ink">₹0</span>
          <span className="text-sm text-ink-muted">/ forever</span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Everything you need to plan real trips, no credit card required.
        </p>

        <ul className="mt-6 flex-1 space-y-3">
          {freeFeatures.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>

        <Button variant="outline" size="lg" fullWidth className="mt-8" onClick={() => navigate("/chat")}>
          Start for free
        </Button>
      </div>

      {/* Premium plan */}
      <div
        className={cn(
          "card-surface relative flex flex-col overflow-hidden border-2 border-brand p-8 shadow-raised"
        )}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-soft blur-2xl" />

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.06em] text-brand">
            Premium
          </p>
          <Badge tone="blue" dot>
            Coming soon
          </Badge>
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-bold text-ink">₹399</span>
          <span className="text-sm text-ink-muted">/ month</span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          For frequent travelers who want faster, deeper planning.
        </p>

        <ul className="mt-6 flex-1 space-y-3">
          {premiumFeatures.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.25} />
              {f}
            </li>
          ))}
        </ul>

        <Button variant="primary" size="lg" fullWidth className="mt-8" disabled>
          Notify me at launch
        </Button>
      </div>
    </div>
  );
}
