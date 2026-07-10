import { Hotel } from "lucide-react";
import type { Hotel as HotelModel } from "../../models/trip";
type Props = {
  hotel: HotelModel;
};

export default function HotelCard({ hotel }: Props) {
  if (!hotel) return null;

  return (
    <div className="w-full rounded-2xl border border-border bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Hotel className="h-5 w-5" />
        </span>

        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
          Hotel
        </span>
      </div>

      <div className="mt-5">
        <h3 className="line-clamp-2 text-lg font-semibold text-ink">
          {hotel.city || hotel.name || "Recommended Hotel"}
        </h3>

        <p className="mt-1 text-sm text-ink-muted">
          {hotel.address || "Recommended stay"}
        </p>
      </div>

      <a
        href={hotel.booking_url || "#"}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
      >
        View Hotels
      </a>
    </div>
  );
}