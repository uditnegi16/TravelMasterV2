import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Trip } from "../../../models/trip";

// Leaflet needs a real layout engine; the map itself is covered by the
// browser check. Here we only need to know what points it was handed.
const mapProps = vi.fn();
vi.mock("../TripMap", () => ({
  default: (props: { points: unknown[]; activeId: string | null }) => {
    mapProps(props);
    return <div data-testid="trip-map" data-active={props.activeId ?? ""} />;
  },
}));

const { default: ItineraryTimeline } = await import("../ItineraryTimeline");
const { default: PackageCard } = await import("../PackageCard");

// Shape copied from what flight_service.py really returns: Duffel's raw
// segments, with airport OBJECTS in origin/destination.
const rawSegment = {
  origin: { iata_code: "CCU", city_name: "Kolkata", latitude: 22.65, longitude: 88.44 },
  destination: { iata_code: "JAI", city_name: "Jaipur", latitude: 26.82, longitude: 75.81 },
  departing_at: "2026-10-24T09:40:00",
  arriving_at: "2026-10-24T12:05:00",
  marketing_carrier: { name: "Duffel Airways", iata_code: "ZZ" },
  marketing_carrier_flight_number: "4312",
};

const flight = {
  airline: "Duffel Airways",
  origin_city: "Kolkata",
  destination_city: "Jaipur",
  duration: "PT2H25M",
  stops: 0,
  segments: [rawSegment],
};

const itinerary = {
  flight,
  hotels: [{ name: "Swagatam RTDC Hotel", rating: 4.1, latitude: 26.91, longitude: 75.78 }],
  total_flight_cost: 5000,
  total_hotel_cost: 13078,
  layover_cost: 0,
  total_trip_cost: 18078,
  remaining_budget: 6922,
  within_budget: true,
};

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    summary: "",
    recommended: { profile: "Best Value" },
    parsed_trip: { destination: "Jaipur", start_date: "2026-10-24", end_date: "2026-10-28" },
    multi_itineraries: [{ profile: "Best Value", itinerary, overall_score: 1 }],
    places: [
      { name: "Hawa Mahal", category: "Palace", latitude: 26.92, longitude: 75.82 },
      { name: "No Coords Temple", category: "Temple" },
    ],
    ...overrides,
  } as Trip;
}

/** The section starts collapsed; most tests want it open. */
async function renderOpen(trip: Trip) {
  const utils = render(<ItineraryTimeline trip={trip} />);
  await userEvent.click(screen.getByRole("button", { name: /your itinerary/i }));
  return utils;
}

describe("ItineraryTimeline", () => {
  it("starts collapsed with a real summary, and opens / closes on click", async () => {
    render(<ItineraryTimeline trip={makeTrip()} />);

    const toggle = screen.getByRole("button", { name: /your itinerary/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("Flight · Hotel · 2 places · Best Value package");
    // collapsed: no timeline, and the map (Leaflet) isn't even mounted
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trip-map")).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(await screen.findByTestId("trip-map")).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("builds stops only from real data, in order, with no invented return flight", async () => {
    await renderOpen(makeTrip());
    // Let the lazy map chunk resolve inside act() (findBy* waits in act),
    // otherwise React warns that a suspended resource loaded outside it.
    await screen.findByTestId("trip-map");

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Kolkata → Jaipur"),
      expect.stringContaining("Swagatam RTDC Hotel"),
      expect.stringContaining("Hawa Mahal"),
      expect.stringContaining("No Coords Temple"),
      expect.stringContaining("Leave Jaipur"),
    ]);
    expect(items[0]).toHaveTextContent("2h 25m");
    expect(items[1]).toHaveTextContent("4 nights");
    expect(screen.queryByText(/return/i)).not.toBeInTheDocument();
  });

  it("only hands the map stops that have real coordinates", async () => {
    await renderOpen(makeTrip());
    await screen.findByTestId("trip-map");

    const { points } = mapProps.mock.lastCall![0] as { points: { id: string }[] };
    // arrival airport, hotel, Hawa Mahal -- not the place with no coords,
    // not the trip-end marker
    expect(points.map((p) => p.id)).toEqual(["flight", "hotel", "place-0"]);
  });

  it("selecting a stop highlights it on the map; stops without coordinates can't be selected", async () => {
    await renderOpen(makeTrip());
    await screen.findByTestId("trip-map");

    await userEvent.click(screen.getByRole("button", { name: /Show Hawa Mahal on the map/ }));
    expect(screen.getByTestId("trip-map")).toHaveAttribute("data-active", "place-0");

    const noCoords = screen.getByText("No Coords Temple").closest("button")!;
    expect(noCoords).toBeDisabled();
  });

  it("renders no map when nothing has coordinates, and nothing at all for an empty trip", async () => {
    const { rerender } = await renderOpen(
      makeTrip({ multi_itineraries: [], recommended: {}, places: [{ name: "Fort" }] }),
    );
    expect(screen.getByText("Fort")).toBeInTheDocument();
    expect(screen.queryByTestId("trip-map")).not.toBeInTheDocument();

    rerender(<ItineraryTimeline trip={makeTrip({ multi_itineraries: [], recommended: {}, places: [] })} />);
    expect(screen.queryByRole("button", { name: /your itinerary/i })).not.toBeInTheDocument();
  });
});

describe("PackageCard with raw Duffel segments", () => {
  it("expands View Details without crashing on airport objects", async () => {
    render(
      <PackageCard
        pkg={{ profile: "Best Value", itinerary, overall_score: 1 }}
        index={0}
        recommended
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /view details/i }));

    expect(screen.getByText(/Kolkata\s*→\s*Jaipur/)).toBeInTheDocument();
    expect(screen.getByText("Duffel Airways · Flight ZZ4312")).toBeInTheDocument();
  });
});