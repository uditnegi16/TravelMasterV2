import { Plane } from "lucide-react";

import type { Flight } from "../../models/trip";

type Props = {
  flight: Flight;
};

export default function FlightCard({ flight }: Props) {
  if (!flight) return null;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Plane className="h-5 w-5" />
        </span>

        <span className="rounded-full bg-accent-greenSoft px-3 py-1 text-xs font-medium text-accent-green">
          Flight
        </span>
      </div>

      <div className="mt-5">
        <h3 className="text-lg font-semibold text-ink">
          {flight.owner || flight.airline || "Unknown Airline"}
        </h3>

        <p className="mt-1 text-sm text-ink-muted">
          {flight.id || "Flight available"}
        </p>
      </div>

      <div className="mt-6">
        <p className="break-words font-mono text-2xl font-semibold text-ink">
          {flight.total_amount ?? "--"} {flight.currency ?? ""}
        </p>
      </div>
    </div>
  );
}