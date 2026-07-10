import { Search, X } from "lucide-react";
import { cn } from "../../../lib/cn";

interface HelpSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  className?: string;
}

export function HelpSearchBar({ value, onChange, resultCount, className }: HelpSearchBarProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[640px]", className)}>
      <div className="input-surface flex items-center gap-3 px-5 py-3.5 shadow-card">
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2.25} />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search help articles..."
          className="w-full bg-transparent text-[0.95rem] text-ink placeholder:text-ink-faint focus:outline-none"
        />

        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {value && (
        <p className="mt-3 text-center text-xs text-ink-faint">
          {resultCount ?? 0} result{resultCount === 1 ? "" : "s"} for “{value}”
        </p>
      )}
    </div>
  );
}
