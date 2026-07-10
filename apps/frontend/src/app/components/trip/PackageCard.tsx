import { useState } from "react";
import { ChevronDown, Plane, Clock } from "lucide-react";

import type { PackageOption, Place, Weather } from "../../models/trip";
import PlaceCard from "./PlaceCard";
import WeatherCard from "./WeatherCard";

type PackageCardProps = {
  pkg: PackageOption;
  recommended: boolean;
  places?: Place[];
  weather?: Weather;
};

function formatTime(iso?: string) {
  if (!iso) return "--";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "₹0";
  return `₹${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function PackageCard({
  pkg,
  recommended,
  places,
  weather,
}: PackageCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { itinerary } = pkg;
  const flight = itinerary.flight;
  const hotel = itinerary.hotels?.[0];

  const flightName = flight?.airline ?? "No flight available";
  const hotelName = hotel?.name ?? hotel?.city ?? "No hotel available";

  return (
    <div className="rounded-3xl border border-border bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-raised">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold text-ink">
            {pkg.profile}
          </h3>

          {recommended && (
            <span className="mt-2 inline-flex rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
              AI Recommended
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">
            Flight
          </p>

          <p className="mt-1 font-medium text-ink">
            {flightName}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">
            Hotel
          </p>

          <p className="mt-1 font-medium text-ink">
            {hotelName}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              Trip Cost
            </p>

            <p className="mt-1 font-semibold text-ink">
              {formatCurrency(itinerary.total_trip_cost)}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              Remaining
            </p>

            <p className="mt-1 font-semibold text-accent-green">
              {formatCurrency(itinerary.remaining_budget)}
            </p>
          </div>
        </div>

        {pkg.tradeoffs && pkg.tradeoffs.length > 0 && (
          <ul className="space-y-1.5 rounded-2xl bg-brand-soft/40 p-4">
            {pkg.tradeoffs.map((note, index) => (
              <li
                key={index}
                className="text-sm leading-5 text-ink-muted"
              >
                {note}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-hover"
      >
        {expanded ? "Hide Details" : "View Details"}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="mt-6 space-y-6 border-t border-border pt-6">
          {/* Flight detail */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-wide text-ink-faint">
              Flight Route
            </p>

            {flight?.segments && flight.segments.length > 0 ? (
              <div className="space-y-3">
                {flight.segments.map((segment, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-2xl border border-border p-4"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Plane className="h-4 w-4" />
                    </span>

                    <div className="flex-1">
                      <p className="font-medium text-ink">
                        {segment.origin_city ?? segment.origin} →{" "}
                        {segment.destination_city ?? segment.destination}
                      </p>

                      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(segment.departing_at)} –{" "}
                        {formatTime(segment.arriving_at)}
                      </p>

                      <p className="mt-1 text-sm text-ink-faint">
                        {segment.carrier}
                        {segment.flight_number
                          ? ` · Flight ${segment.flight_number}`
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}

                {flight && flight.stops !== undefined && flight.stops > 0 && (
                  <p className="text-sm text-ink-muted">
                    {flight.stops} stop{flight.stops > 1 ? "s" : ""}
                    {flight.layover_city
                      ? ` via ${flight.layover_city}`
                      : ""}
                    {flight.layover_duration_minutes
                      ? ` (${Math.round(
                          flight.layover_duration_minutes / 60
                        )}h layover)`
                      : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                No detailed route available for this flight.
              </p>
            )}
          </div>

          {/* Hotel detail */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-wide text-ink-faint">
              Hotel
            </p>

            {hotel ? (
              <div className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{hotel.name}</p>

                    {hotel.address && (
                      <p className="mt-1 text-sm text-ink-muted">
                        {hotel.address}
                      </p>
                    )}
                  </div>

                  {hotel.rating !== undefined && (
                    <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                      {hotel.rating}★
                    </span>
                  )}
                </div>

                {hotel.amenities && hotel.amenities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {hotel.amenities.map((amenity, index) => (
                      <span
                        key={index}
                        className="rounded-full bg-accent-greenSoft px-3 py-1 text-xs font-medium text-accent-green"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                )}

                {hotel.booking_url && (
                  <a
                    href={hotel.booking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover"
                  >
                    View Hotel
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                No hotel selected for this package.
              </p>
            )}
          </div>

          {/* Budget breakdown */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-wide text-ink-faint">
              Budget Breakdown
            </p>

            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border p-4">
              <div>
                <p className="text-xs text-ink-faint">Flight</p>
                <p className="mt-1 font-semibold text-ink">
                  {formatCurrency(itinerary.total_flight_cost)}
                </p>
              </div>

              <div>
                <p className="text-xs text-ink-faint">Hotel</p>
                <p className="mt-1 font-semibold text-ink">
                  {formatCurrency(itinerary.total_hotel_cost)}
                </p>
              </div>

              <div>
                <p className="text-xs text-ink-faint">Remaining</p>
                <p className="mt-1 font-semibold text-accent-green">
                  {formatCurrency(itinerary.remaining_budget)}
                </p>
              </div>
            </div>
          </div>

          {/* Places */}
          {places && places.length > 0 && (
            <div>
              <p className="mb-3 text-xs uppercase tracking-wide text-ink-faint">
                Things To Do
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {places.map((place, index) => (
                  <PlaceCard key={index} place={place} />
                ))}
              </div>
            </div>
          )}

          {/* Weather */}
          {weather && (
            <div>
              <p className="mb-3 text-xs uppercase tracking-wide text-ink-faint">
                Weather
              </p>

              <WeatherCard weather={weather} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}