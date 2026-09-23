import { lazy, Suspense, useId, useMemo, useState } from "react";
import { Plane, Hotel as HotelIcon, MapPin, Flag, ExternalLink, CloudSun, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Trip } from "../../models/trip";
import { CATEGORY } from "./tripTheme";
import {
  flightRoute,
  formatDay,
  formatIsoDuration,
  formatTime,
  nightsBetween,
  segmentAirport,
} from "./flightFormat";
import type { MapPoint } from "./TripMap";

// Leaflet + its CSS (~40 KB gzip) only download once a trip with
// mappable stops is actually on screen.
const TripMap = lazy(() => import("./TripMap"));

export type StopKind = "flight" | "hotel" | "place" | "end";

type Stop = {
  id: string;
  kind: StopKind;
  /** Small caps line above the title, e.g. "Mon, 5 Oct · 9:40 AM · Flight". */
  when: string;
  title: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
  lat?: number;
  lon?: number;
  /** Text inside the map pin. */
  pin: string;
};

const ICON: Record<StopKind, LucideIcon> = {
  flight: Plane,
  hotel: HotelIcon,
  place: MapPin,
  end: Flag,
};

const NODE: Record<StopKind, string> = {
  flight: CATEGORY.flight.dot,
  hotel: CATEGORY.hotel.dot,
  place: CATEGORY.place.dot,
  end: CATEGORY.weather.dot,
};

const LABEL: Record<StopKind, string> = {
  flight: "Flight",
  hotel: "Hotel",
  place: "Place",
  end: "Trip ends",
};

function isCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Builds the stop list ONLY from data the backend really returned --
 * no invented times or day splits. Flight and hotel come from the
 * recommended package (the one the AI picked); places and weather are
 * trip-wide. The backend searches one-way flights (flight_service.py
 * reads offer.slices[0]), so there is deliberately no "return flight"
 * stop -- just the trip end date, when the planner parsed one.
 */
function buildStops(trip: Trip): { stops: Stop[]; profile?: string } {
  const packages = trip.multi_itineraries ?? [];
  const recommendedProfile = trip.recommended?.profile;
  const pkg =
    packages.find((p) => p.profile === recommendedProfile) ?? packages[0];

  const flight = pkg?.itinerary.flight ?? trip.recommended?.flight ?? null;
  const hotel = pkg?.itinerary.hotels?.[0] ?? trip.recommended?.hotel ?? null;
  const start = trip.parsed_trip?.start_date;
  const end = trip.parsed_trip?.end_date;

  const stops: Stop[] = [];

  if (flight) {
    const segs = flight.segments ?? [];
    const first = segs[0];
    const last = segs[segs.length - 1];
    const { from, to } = flightRoute(flight);
    const arrival = segmentAirport(last, "destination");

    const stopsText =
      flight.stops && flight.stops > 0
        ? `${flight.stops} stop${flight.stops > 1 ? "s" : ""}${flight.layover_city ? ` via ${flight.layover_city}` : ""}`
        : "Direct";

    stops.push({
      id: "flight",
      kind: "flight",
      when: [formatDay(first?.departing_at ?? start), formatTime(first?.departing_at), LABEL.flight]
        .filter(Boolean)
        .join(" · "),
      title: `${from} → ${to}`,
      detail: [
        flight.airline || flight.owner,
        formatIsoDuration(flight.duration),
        stopsText,
        last?.arriving_at ? `lands ${formatTime(last.arriving_at)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      lat: arrival?.latitude,
      lon: arrival?.longitude,
      pin: "✈",
    });
  }

  if (hotel) {
    const nights = nightsBetween(start, end);
    const checkIn = formatDay(last(flight?.segments)?.arriving_at ?? start);
    stops.push({
      id: "hotel",
      kind: "hotel",
      when: [checkIn, "Check in", LABEL.hotel].filter(Boolean).join(" · "),
      title: hotel.name ?? hotel.city ?? "Your hotel",
      detail: [
        nights ? `${nights} night${nights > 1 ? "s" : ""}` : "",
        hotel.rating ? `${hotel.rating}★` : "",
        hotel.hotel_class ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
      href: hotel.booking_url,
      hrefLabel: "Book",
      lat: hotel.latitude,
      lon: hotel.longitude,
      pin: "H",
    });
  }

  (trip.places ?? []).forEach((place, i) => {
    stops.push({
      id: `place-${i}`,
      kind: "place",
      when: [place.category || place.type || "Attraction", LABEL.place].join(" · "),
      title: place.name,
      href: place.maps_url,
      hrefLabel: "Maps",
      lat: place.latitude,
      lon: place.longitude,
      pin: String(i + 1),
    });
  });

  if (end && stops.length > 0) {
    stops.push({
      id: "end",
      kind: "end",
      when: [formatDay(end), LABEL.end].filter(Boolean).join(" · "),
      title: trip.parsed_trip?.destination_city || trip.parsed_trip?.destination
        ? `Leave ${trip.parsed_trip?.destination_city || trip.parsed_trip?.destination}`
        : "End of trip",
      pin: "",
    });
  }

  return { stops, profile: pkg?.profile };
}

function last<T>(list?: T[]): T | undefined {
  return list && list.length ? list[list.length - 1] : undefined;
}

export default function ItineraryTimeline({ trip }: { trip: Trip }) {
  const { stops, profile } = useMemo(() => buildStops(trip), [trip]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Collapsed by default: the package cards are the primary answer; the
  // itinerary is detail you open on demand. Closed also means Leaflet
  // (and map tiles) are never downloaded unless someone looks.
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  const points = useMemo<MapPoint[]>(
    () =>
      stops
        .filter((s) => isCoord(s.lat) && isCoord(s.lon))
        .map((s) => ({
          id: s.id,
          kind: s.kind,
          lat: s.lat as number,
          lon: s.lon as number,
          label: s.pin,
          title: s.title,
        })),
    [stops],
  );

  // Nothing real to lay out (e.g. a clarification turn) -> no section.
  if (stops.filter((s) => s.kind !== "end").length === 0) return null;

  const weather = trip.weather;
  const hasMap = points.length > 0;

  // One-line preview shown while collapsed, e.g. "Flight · Hotel · 5 places".
  const count = (k: StopKind) => stops.filter((s) => s.kind === k).length;
  const places = count("place");
  const summary = [
    count("flight") ? "Flight" : "",
    count("hotel") ? "Hotel" : "",
    places ? `${places} place${places > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-labelledby="itinerary-heading" className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-subtle p-2 pr-3 transition hover:border-border-strong">
        {/* Accordion pattern: the button lives INSIDE the heading (a
            heading isn't allowed inside a <button>). */}
        <h2 id="itinerary-heading" className="m-0 flex w-full min-w-0 font-sans tracking-normal sm:w-auto sm:flex-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left"
        >
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${CATEGORY.place.badgeBg} ${CATEGORY.place.badgeText}`}
          >
            <MapPin className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
              Your itinerary
            </span>
            <span className="mt-0.5 block text-sm font-normal text-ink-muted">
              {summary}
              {profile && (
                <>
                  {" · "}
                  <span className="font-medium text-ink">{profile}</span> package
                </>
              )}
            </span>
          </span>
          <span className="hidden shrink-0 text-xs font-semibold text-ink-muted sm:inline">
            {open ? "Hide" : hasMap ? "Show timeline & map" : "Show timeline"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-5 w-5 shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
        </h2>

        {weather && (weather.temperature !== undefined || weather.condition) && (
          // Phone: own line under the title, lined up with its text (ml-14).
          <span className="mb-2 ml-14 inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-medium text-ink-muted sm:mb-0 sm:ml-0">
            <CloudSun className="h-3.5 w-3.5" />
            {[
              weather.temperature !== undefined ? `${Math.round(weather.temperature)}°C` : "",
              weather.condition ?? "",
              weather.city || weather.location || "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </div>

      {open && (
      <div id={bodyId} className="mt-5 animate-fadeIn">
      <div
        className={
          hasMap
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
            : "grid"
        }
      >
        {hasMap && (
          // Map first on a phone (a picture of the trip before the list);
          // on desktop it sits to the right and stays in view while the
          // timeline scrolls past it.
          <div className="h-64 sm:h-72 lg:order-2 lg:sticky lg:top-20 lg:h-[26rem] lg:self-start">
            <Suspense
              fallback={
                <div className="h-full w-full animate-pulse rounded-2xl border border-border bg-surface-sunken" />
              }
            >
              <TripMap points={points} activeId={activeId} onSelect={setActiveId} />
            </Suspense>
          </div>
        )}

        <ol className="lg:order-1">
          {stops.map((stop, i) => {
            const Icon = ICON[stop.kind];
            const isLast = i === stops.length - 1;
            const mappable = isCoord(stop.lat) && isCoord(stop.lon);
            const active = activeId === stop.id;

            return (
              <li key={stop.id} className="flex gap-4">
                {/* Node + stem */}
                <div className="flex flex-col items-center pt-1" aria-hidden="true">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-4 ring-surface-raised ${NODE[stop.kind]}`}
                  >
                    {stop.kind === "place" ? stop.pin : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  {!isLast && <span className="mt-1 w-0.5 flex-1 rounded-full bg-border" />}
                </div>

                {/* Card */}
                <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-5"}`}>
                  <div
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 transition ${
                      active
                        ? "border-brand bg-brand-softer"
                        : "border-transparent hover:border-border hover:bg-surface-subtle"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={!mappable}
                      onClick={() => setActiveId(stop.id)}
                      aria-pressed={mappable ? active : undefined}
                      aria-label={mappable ? `Show ${stop.title} on the map` : undefined}
                      className="focus-ring min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                        {stop.when}
                      </p>
                      <p className="mt-0.5 break-words font-semibold text-ink">{stop.title}</p>
                      {stop.detail && (
                        <p className="mt-0.5 text-sm text-ink-muted">{stop.detail}</p>
                      )}
                    </button>

                    {stop.href && (
                      <a
                        href={stop.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${stop.hrefLabel} — ${stop.title}`}
                        className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                      >
                        {stop.hrefLabel}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      </div>
      )}
    </section>
  );
}