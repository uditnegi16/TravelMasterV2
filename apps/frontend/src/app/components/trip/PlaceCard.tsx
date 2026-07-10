import { MapPin } from "lucide-react";

import type { Place } from "../../models/trip";

type Props = {
  place: Place;
};

export default function PlaceCard({ place }: Props) {
  if (!place) return null;

 return (
    <div className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-white p-5 shadow-soft">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <MapPin className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 break-words text-lg font-semibold leading-6 text-ink">
            {place.name}
          </h3>

          <p className="mt-1 line-clamp-1 break-words text-sm text-ink-muted">
            {place.category || place.type || "Attraction"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <a
          href={place.maps_url || "#"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover"
        >
          Open Maps
        </a>
      </div>
    </div>
  );
}