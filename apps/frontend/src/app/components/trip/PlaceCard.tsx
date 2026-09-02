import { MapPin, ExternalLink } from "lucide-react";

import type { Place } from "../../models/trip";

type Props = {
  place: Place;
};

/**
 * A horizontal row rather than a stacked card.
 *
 * The previous layout stacked icon, name and a full-width "Open Maps"
 * button, then placed two of them side by side. Tailwind's breakpoints
 * measure the VIEWPORT, not the container, so on a desktop the narrow
 * trip panel still got two columns -- about 100px per card, which
 * truncated names to "Ch u..." and left a button wider than the text it
 * belonged to.
 *
 * Laid out horizontally, the name gets the full width of the row and
 * the link shrinks to what it actually needs.
 */
export default function PlaceCard({ place }: Props) {
  if (!place) return null;

  const label = place.category || place.type || "Attraction";

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface-raised p-3 shadow-soft transition hover:border-border-strong">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <MapPin className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <h3
          title={place.name}
          className="line-clamp-2 break-words text-sm font-semibold leading-5 text-ink"
        >
          {place.name}
        </h3>

        <p className="mt-0.5 line-clamp-1 break-words text-xs text-ink-muted">
          {label}
        </p>
      </div>

      <a
        href={place.maps_url || "#"}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${place.name} in Google Maps`}
        className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand px-2.5 py-1.5 text-xs font-medium text-brand transition hover:bg-brand hover:text-white"
      >
        <span className="hidden sm:inline">Maps</span>
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
