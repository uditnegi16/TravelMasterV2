import { useNavigate } from "react-router-dom";
import { Compass, ArrowRight, Home } from "lucide-react";
import { Button } from "../components/ui/Button";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-[calc(100vh-72px)] items-center justify-center overflow-hidden bg-white px-4 py-20">
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-soft blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <span className="absolute inset-0 animate-drift rounded-3xl bg-brand-soft" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-brand text-white shadow-raised">
            <Compass className="h-9 w-9" strokeWidth={1.75} />
          </span>
        </div>

        <p className="mt-8 font-mono text-sm font-semibold tracking-[0.1em] text-ink-faint">
          404
        </p>

        <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
          Looks like this trip doesn't exist
        </h1>

        <p className="mt-4 max-w-[42ch] text-md leading-relaxed text-ink-muted">
          The page you're looking for may have moved, or the link might be
          off by a stop. Let's get you back on route.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            icon={<Home className="h-[18px] w-[18px]" />}
            onClick={() => navigate("/")}
          >
            Back home
          </Button>

          <Button
            variant="outline"
            size="lg"
            icon={<ArrowRight className="h-[18px] w-[18px]" />}
            iconPosition="right"
            onClick={() => navigate("/chat")}
          >
            Plan a trip instead
          </Button>
        </div>
      </div>
    </div>
  );
}
