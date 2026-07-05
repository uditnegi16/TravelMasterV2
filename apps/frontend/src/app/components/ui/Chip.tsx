import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../../lib/cn";
interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  active?: boolean;
}

export function Chip({ icon, active, className, children, ...props }: ChipProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 ease-out active:scale-[0.97] focus-ring",
        active
          ? "border-brand bg-brand-soft text-brand-text"
          : "border-border-strong bg-white text-ink-muted hover:border-ink/30 hover:text-ink hover:bg-surface-subtle",
        className
      )}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0 opacity-70">{icon}</span>}
      {children}
    </button>
  );
}
