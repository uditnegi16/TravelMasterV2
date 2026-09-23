import type { Airport, Flight, FlightSegment } from "../../models/trip";

/**
 * Helpers for reading flight data as the backend actually sends it.
 *
 * flight_service.py passes Duffel's raw `segments` straight through, so a
 * segment's origin/destination are airport OBJECTS
 * ({ iata_code, city_name, latitude, ... }) and the carrier lives under
 * `marketing_carrier`. Rendering `segment.origin` directly (as the old
 * "View Details" route did) passes an object to React, which throws.
 */

function asAirport(value: string | Airport | undefined): Airport | null {
  if (!value) return null;
  return typeof value === "string" ? { iata_code: value } : value;
}

export function segmentEndpoint(
  segment: FlightSegment,
  side: "origin" | "destination",
): string {
  const named = side === "origin" ? segment.origin_city : segment.destination_city;
  if (named) return named;
  const airport = asAirport(segment[side]);
  return airport?.city_name || airport?.name || airport?.iata_code || "—";
}

export function segmentAirport(
  segment: FlightSegment | undefined,
  side: "origin" | "destination",
): Airport | null {
  return segment ? asAirport(segment[side]) : null;
}

export function segmentCarrier(segment: FlightSegment): string {
  const name = segment.carrier || segment.marketing_carrier?.name || "";
  const number = segment.flight_number || segment.marketing_carrier_flight_number;
  const code = segment.marketing_carrier?.iata_code;
  if (number) return `${name}${name ? " · " : ""}Flight ${code ?? ""}${number}`;
  return name;
}

export function flightRoute(flight: Flight): { from: string; to: string } {
  const segs = flight.segments ?? [];
  return {
    from: flight.origin_city || (segs[0] ? segmentEndpoint(segs[0], "origin") : flight.origin) || "—",
    to:
      flight.destination_city ||
      (segs.length ? segmentEndpoint(segs[segs.length - 1], "destination") : flight.destination) ||
      "—",
  };
}

/** "PT1H10M" -> "1h 10m". Returns the input unchanged if it isn't ISO 8601. */
export function formatIsoDuration(iso?: string): string {
  if (!iso) return "";
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return iso;
  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0) + days * 24;
  const mins = Number(m[3] ?? 0);
  if (!hours && !mins) return iso;
  return [hours ? `${hours}h` : "", mins ? `${mins}m` : ""].filter(Boolean).join(" ");
}

function parse(iso?: string): Date | null {
  if (!iso) return null;
  // A bare "2026-10-05" is parsed as UTC midnight by the spec, which can
  // show as the previous day west of UTC. Treat date-only as local.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Duffel times are the airport's local time with no offset; showing them
 *  as-is (no timezone conversion) is what a traveller expects. */
export function formatTime(iso?: string): string {
  const d = parse(iso);
  return d ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
}

export function formatDay(iso?: string): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) : "";
}

export function nightsBetween(start?: string, end?: string): number | null {
  const a = parse(start);
  const b = parse(end);
  if (!a || !b) return null;
  const n = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return n > 0 ? n : null;
}