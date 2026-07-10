import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../../lib/cn";

interface OfflineStateProps {
  fullPage?: boolean;
  className?: string;
}

export function OfflineState({ fullPage = false, className }: OfflineStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 text-center",
        fullPage ? "min-h-[calc(100vh-72px)] justify-center py-20" : "py-16",
        className
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-sunken text-ink-muted">
        <WifiOff className="h-6 w-6" strokeWidth={2} />
      </span>

      <h2 className="mt-5 font-display text-2xl font-bold text-ink">
        You're offline
      </h2>

      <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ink-muted">
        TravelMaster needs a connection to search live flights, hotels, and
        pricing. Reconnect and try again.
      </p>

      <Button
        variant="primary"
        size="md"
        className="mt-7"
        icon={<RefreshCw className="h-4 w-4" />}
        onClick={() => window.location.reload()}
      >
        Retry connection
      </Button>
    </div>
  );
}

/** Slim banner variant for pinning to the top of a page while offline */
export function OfflineBanner() {
  return (
    <div className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-xs font-medium text-white">
      <WifiOff className="h-3.5 w-3.5" />
      You're offline — some features may not work.
    </div>
  );
}
