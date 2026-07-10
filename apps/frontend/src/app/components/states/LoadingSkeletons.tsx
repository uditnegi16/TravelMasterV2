import { cn } from "../../../lib/cn";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulseSoft rounded-lg bg-surface-sunken",
        className
      )}
    />
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Shimmer className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2.5 pt-1">
        <Shimmer className="h-3.5 w-3/5" />
        <Shimmer className="h-3.5 w-4/5" />
        <Shimmer className="h-3.5 w-2/5" />
      </div>
    </div>
  );
}

export function ChatSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} />
      ))}
    </div>
  );
}

export function TripCardSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <Shimmer className="h-40 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Shimmer className="h-4 w-2/3" />
        <Shimmer className="h-3.5 w-1/2" />
        <div className="flex gap-2 pt-2">
          <Shimmer className="h-6 w-16 rounded-full" />
          <Shimmer className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function TripCardSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SidebarListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function LineSkeleton({ className }: { className?: string }) {
  return <Shimmer className={cn("h-3.5 w-full", className)} />;
}
