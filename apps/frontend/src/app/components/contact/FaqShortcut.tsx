import { Link } from "react-router-dom";
import { LifeBuoy, ArrowRight } from "lucide-react";

export function FaqShortcut() {
  return (
    <Link
      to="/help"
      className="group card-surface flex items-center justify-between gap-4 p-5 transition-shadow hover:shadow-raised"
    >
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink-muted transition-colors group-hover:bg-brand-soft group-hover:text-brand">
          <LifeBuoy className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            Looking for a quick answer?
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Check the Help Center before you write in.
          </p>
        </div>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-brand" />
    </Link>
  );
}
