import { useState } from "react";
import { ChevronDown, Plane, Clock, Hotel as HotelIcon } from "lucide-react";

import type { PackageOption, Place, Weather } from "../../models/trip";
import PlaceCard from "./PlaceCard";
import WeatherCard from "./WeatherCard";
import { getTierTheme, CATEGORY } from "./tripTheme";
import { segmentCarrier, segmentEndpoint } from "./flightFormat";

type PackageCardProps = {
  pkg: PackageOption;
  recommended: boolean;
  index: number;
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
  // Whole rupees. A trip estimate shown as "₹63,469.23" reads as a
  // rounding bug, not precision -- the underlying figures are
  // converted from a foreign currency and are estimates anyway.
  return `₹${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function PackageCard({
  pkg,
  recommended,
  index,
  places,
  weather,
}: PackageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const theme = getTierTheme(pkg.profile, index);

  const { itinerary } = pkg;
  const flight = itinerary.flight;
  const hotel = itinerary.hotels?.[0];

  const flightName = flight?.airline ?? "No flight available";
  const hotelName = hotel?.name ?? hotel?.city ?? "No hotel available";

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface-raised shadow-soft transition-all hover:-translate-y-1 hover:shadow-raised">
      {/* Stand-in for a destination photo — a flat tier-colored banner
          rather than a real image, since there's no photo asset pipeline
          yet. Swap the inner icon block for an <img>/<picture> once one
          exists; the badge and gradient are built to sit on top of either. */}
      <div className={`relative flex h-24 items-center justify-center ${theme.banner}`}>
        {recommended && (
          <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#12141c] shadow-soft">
            AI Recommended
          </span>
        )}
        <Plane className="h-7 w-7 text-white/40" strokeWidth={1.5} />
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold text-ink">{pkg.profile}</h3>

            <span
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${theme.badgeBg} ${theme.badgeText}`}
            >
              {theme.label}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-faint">
              <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY.flight.dot}`} />
              Flight
            </p>

            <p className="mt-1 font-medium text-ink">
              {flightName}
            </p>

            {/* Duffel runs in sandbox mode: it returns canned offers that
                do not correspond to the requested route or dates. Saying so
                is better than a reader assuming the app got it wrong. */}
            {flight && (
              <p className="mt-1 text-[11px] leading-4 text-ink-faint">
                Demo flight data — not a bookable fare
              </p>
            )}
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-faint">
              <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY.hotel.dot}`} />
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

              <p className="mt-1 break-words text-sm font-semibold text-ink sm:text-base">
                {formatCurrency(itinerary.total_trip_cost)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                Remaining
              </p>

              <p className="mt-1 break-words text-sm font-semibold text-accent-green sm:text-base">
                {formatCurrency(itinerary.remaining_budget)}
              </p>
            </div>
          </div>

          {pkg.tradeoffs && pkg.tradeoffs.length > 0 && (
            <ul className="space-y-1.5 rounded-2xl bg-brand-soft/40 p-4">
              {pkg.tradeoffs.map((note, tIndex) => (
                <li
                  key={tIndex}
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
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition ${theme.button}`}
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
              <p className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-faint">
                <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY.flight.dot}`} />
                Flight Route
              </p>

              {flight?.segments && flight.segments.length > 0 ? (
                <div className="space-y-3">
                  {flight.segments.map((segment, sIndex) => (
                    <div
                      key={sIndex}
                      className="flex items-start gap-3 rounded-2xl border border-border p-4"
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${CATEGORY.flight.badgeBg} ${CATEGORY.flight.badgeText}`}>
                        <Plane className="h-4 w-4" />
                      </span>

                      <div className="flex-1">
                        <p className="font-medium text-ink">
                          {/* Raw Duffel segments carry airport OBJECTS in
                              origin/destination -- rendering them directly
                              threw "Objects are not valid as a React child". */}
                          {segmentEndpoint(segment, "origin")} →{" "}
                          {segmentEndpoint(segment, "destination")}
                        </p>

                        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(segment.departing_at)} –{" "}
                          {formatTime(segment.arriving_at)}
                        </p>

                        {segmentCarrier(segment) && (
                          <p className="mt-1 text-sm text-ink-faint">
                            {segmentCarrier(segment)}
                          </p>
                        )}
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
              <p className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-faint">
                <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY.hotel.dot}`} />
                Hotel
              </p>

              {hotel ? (
                <div className="rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${CATEGORY.hotel.badgeBg} ${CATEGORY.hotel.badgeText}`}>
                        <HotelIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium text-ink">{hotel.name}</p>

                        {hotel.address && (
                          <p className="mt-1 text-sm text-ink-muted">
                            {hotel.address}
                          </p>
                        )}
                      </div>
                    </div>

                    {hotel.rating !== undefined && (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORY.hotel.badgeBg} ${CATEGORY.hotel.badgeText}`}>
                        {hotel.rating}★
                      </span>
                    )}
                  </div>

                  {hotel.amenities && hotel.amenities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {hotel.amenities.map((amenity, aIndex) => (
                        <span
                          key={aIndex}
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

              {/* Label/value rows, not columns. Three currency values
                  never fit side by side in this panel -- the viewport is
                  wide but the panel is not, and Tailwind breakpoints only
                  see the viewport -- so "₹26,848.39" wrapped mid-number. */}
              <div className="space-y-2 rounded-2xl border border-border p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-xs text-ink-faint">Flight</span>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
                    {formatCurrency(itinerary.total_flight_cost)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-xs text-ink-faint">Hotel</span>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
                    {formatCurrency(itinerary.total_hotel_cost)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2">
                  <span className="text-xs text-ink-faint">Remaining</span>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-accent-green">
                    {formatCurrency(itinerary.remaining_budget)}
                  </span>
                </div>
              </div>
            </div>

            {/* Places */}
            {places && places.length > 0 && (
              <div>
                <p className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-faint">
                  <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY.place.dot}`} />
                  Things To Do
                </p>

                {/* Single column, deliberately. This panel sits inside a
                    package card and stays narrow even on a wide screen,
                    and Tailwind breakpoints only see the viewport -- so a
                    column rule split it into ~110px rows where the icon
                    and the Maps link took the full width and the place
                    name collapsed to nothing. */}
                <div className="flex flex-col gap-2">
                  {places.map((place, pIndex) => (
                    <PlaceCard key={pIndex} place={place} />
                  ))}
                </div>
              </div>
            )}

            {/* Weather */}
            {weather && (
              <div>
                <p className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-faint">
                  <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY.weather.dot}`} />
                  Weather
                </p>

                <WeatherCard weather={weather} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}