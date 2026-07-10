import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { cn } from "../../../lib/cn";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Renders centered and full height, for use as a standalone route */
  fullPage?: boolean;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We hit a snag loading this. Please try again — if it keeps happening, let us know.",
  onRetry,
  fullPage = false,
  className,
}: ErrorStateProps) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 text-center",
        fullPage ? "min-h-[calc(100vh-72px)] justify-center py-20" : "py-16",
        className
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-redSoft text-accent-red">
        <AlertTriangle className="h-6 w-6" strokeWidth={2} />
      </span>

      <h2 className="mt-5 font-display text-2xl font-bold text-ink">{title}</h2>

      <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ink-muted">
        {message}
      </p>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        {onRetry && (
          <Button
            variant="primary"
            size="md"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={onRetry}
          >
            Try again
          </Button>
        )}

        {fullPage && (
          <Button
            variant="outline"
            size="md"
            icon={<Home className="h-4 w-4" />}
            onClick={() => navigate("/")}
          >
            Back home
          </Button>
        )}
      </div>
    </div>
  );
}
