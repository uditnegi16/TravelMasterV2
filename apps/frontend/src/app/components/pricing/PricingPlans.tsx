import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser, SignInButton } from "@clerk/clerk-react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../../lib/cn";
import { createOrder, verifyPayment } from "../../services/api";

const freeFeatures = [
  "7 AI trip plans per month",
  "Real flight & hotel search",
  "Voice input",
  "PDF export & trip sharing",
  "Full chat history",
];

const premiumFeatures = [
  "100 AI trip plans per month",
  "Everything else in Free",
  "Priority AI response speed",
  "Multi-city & longer itineraries",
  "Early access to new features",
  "Priority support",
];

export function PricingPlans() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { isSignedIn } = useUser();
  const [upgrading, setUpgrading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleUpgrade() {
    setUpgrading(true);
    setStatus(null);
    try {
      const token = await getToken();
      if (!token) {
        setStatus({ type: "error", message: "Please sign in first." });
        return;
      }

      const order = await createOrder(token);

      const razorpay = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "TravelMaster Premium",
        description: "Premium Subscription",
        theme: { color: "#2563eb" },
        handler: async (response) => {
          try {
            await verifyPayment(token, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setStatus({ type: "success", message: "Premium activated! You now have 100 trip plans per month." });
          } catch {
            setStatus({
              type: "error",
              message: "Payment verification failed. Contact support if you were charged.",
            });
          }
        },
      });

      razorpay.open();
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Unable to start payment. Please try again." });
    } finally {
      setUpgrading(false);
    }
  }

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

        {isSignedIn ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="mt-8"
            onClick={handleUpgrade}
            disabled={upgrading}
          >
            {upgrading ? "Starting checkout..." : "Upgrade to Premium"}
          </Button>
        ) : (
          <SignInButton mode="modal">
            <Button variant="primary" size="lg" fullWidth className="mt-8">
              Sign in to upgrade
            </Button>
          </SignInButton>
        )}

        {status && (
          <div
            className={cn(
              "mt-4 flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm",
              status.type === "success"
                ? "bg-accent-greenSoft text-accent-green"
                : "bg-red-50 text-red-700",
            )}
          >
            <p>{status.message}</p>
            <button
              type="button"
              onClick={() => setStatus(null)}
              className="shrink-0 text-xs font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}