import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { StopKind } from "./ItineraryTimeline";

export type MapPoint = {
  id: string;
  kind: StopKind;
  lat: number;
  lon: number;
  /** Short text inside the pin: a stop number, or a letter for flight/hotel. */
  label: string;
  title: string;
};

type Props = {
  points: MapPoint[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

// Same flight / hotel / place colors as the timeline nodes and the rest
// of the product (tripTheme.tsx CATEGORY). Written out as full literal
// class strings so Tailwind's content scan picks them up -- they only
// ever appear inside Leaflet's divIcon HTML, never in JSX.
const PIN_CLASS: Record<StopKind, string> = {
  flight: "bg-brand",
  hotel: "bg-accent-amber",
  place: "bg-accent-teal",
  end: "bg-ink-faint",
};

// CARTO basemaps (built on OpenStreetMap data): a light and a dark style
// that match the app's two themes. Attribution is required by both
// OSM and CARTO and is kept visible. Swap these two URLs to change the
// tile provider -- nothing else depends on them.
const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function isDark() {
  return document.documentElement.classList.contains("dark");
}

function textNode(text: string) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

function pinIcon(point: MapPoint, active: boolean) {
  const size = active ? 34 : 26;
  return L.divIcon({
    className: "", // drop Leaflet's default white square
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="flex h-full w-full items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-raised transition-transform ${PIN_CLASS[point.kind]} ${active ? "ring-4 ring-white/60" : ""}">${point.label}</span>`,
  });
}

export default function TripMap({ points, activeId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Build the map once per set of points.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || points.length === 0) return;

    const touch = L.Browser.mobile;
    const map = L.map(el, {
      // Never hijack the chat's own scrolling: wheel zoom off, and on a
      // phone one-finger drag scrolls the page instead of the map. The
      // +/- buttons (and pinch on touch) still zoom.
      scrollWheelZoom: false,
      dragging: !touch,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    tilesRef.current = L.tileLayer(isDark() ? TILES.dark : TILES.light, {
      attribution: ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    // Route line in timeline order: arrival airport -> hotel -> places.
    const route = points.map((p) => L.latLng(p.lat, p.lon));
    if (route.length > 1) {
      L.polyline(route, {
        // A literal, not var(--brand): Leaflet writes this as an SVG
        // attribute, where CSS variables don't resolve. Mid blue reads on
        // both the light and dark basemaps.
        color: "#4f7cf0",
        weight: 2,
        opacity: 0.55,
        dashArray: "4 6",
      }).addTo(map);
    }

    const markers = new Map<string, L.Marker>();
    for (const p of points) {
      const marker = L.marker([p.lat, p.lon], {
        icon: pinIcon(p, false),
        title: p.title,
        keyboard: true,
      })
        // Pass a text node, never a string: Leaflet sets string tooltip
        // content as innerHTML, and place names come from a third-party
        // API (OpenTripMap).
        .bindTooltip(textNode(p.title), { direction: "top", offset: [0, -14] })
        .on("click", () => onSelectRef.current(p.id))
        .addTo(map);
      markers.set(p.id, marker);
    }
    markersRef.current = markers;

    // Frame the stops you'll actually walk between (hotel + places).
    // The arrival airport is often 15-40 km out; including it zooms the
    // map so far out that nearby places stack on top of each other. It
    // stays on the map -- picking the flight stop pans to it.
    const local = points.filter((p) => p.kind !== "flight");
    const framed = (local.length >= 2 ? local : points).map((p) => L.latLng(p.lat, p.lon));
    if (framed.length === 1) map.setView(framed[0], 14);
    else map.fitBounds(L.latLngBounds(framed), { padding: [32, 32], maxZoom: 15 });

    // The container can change size after mount (lazy load, sidebar
    // toggle, the header card reflowing) -- keep tiles filling it.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);

    // Follow the app's light/dark toggle (a class on <html>).
    const mo = new MutationObserver(() => {
      tilesRef.current?.setUrl(isDark() ? TILES.dark : TILES.light);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      ro.disconnect();
      mo.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = new Map();
    };
  }, [points]);

  // Highlight + center the stop picked in the timeline (or on the map).
  useEffect(() => {
    const map = mapRef.current;
    for (const p of points) {
      markersRef.current.get(p.id)?.setIcon(pinIcon(p, p.id === activeId));
    }
    if (!map || !activeId) return;
    const marker = markersRef.current.get(activeId);
    if (!marker) return;
    marker.setZIndexOffset(1000);
    // Zoom in as well as pan: stops a few hundred metres apart (e.g.
    // Hawa Mahal / City Palace / Jantar Mantar) overlap at the overview
    // zoom, and picking one should separate them.
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.6 });
    marker.openTooltip();
  }, [activeId, points]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Map of your trip stops"
      // `isolate` gives Leaflet its own stacking context: its panes and
      // controls use z-index 400-1000, which would otherwise paint over
      // the chat header and the portaled Share menu.
      // `!bg-…` beats leaflet.css's own light-grey .leaflet-container
      // background, which flashed in dark mode before tiles loaded.
      className="isolate h-full min-h-[16rem] w-full overflow-hidden rounded-2xl border border-border !bg-surface-sunken"
    />
  );
}