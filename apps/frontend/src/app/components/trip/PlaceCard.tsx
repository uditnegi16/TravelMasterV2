import { MapPin } from "lucide-react";

import type { Place } from "../../models/trip";

type Props = {
  place: Place;
};

export default function PlaceCard({ place }: Props) {
  if (!place) return null;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <MapPin className="h-5 w-5" />
        </span>

        <div>
          <h3  className="line-clamp-2 text-lg font-semibold text-ink">
            {place.name}
          </h3>

          <p className="text-sm text-ink-muted">
            {place.category || place.type || "Attraction"}
          </p>
        </div>
      </div>

      <a
        href={place.maps_url || "#"}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover"
      >
        Open Maps
      </a>
    </div>
  );
}