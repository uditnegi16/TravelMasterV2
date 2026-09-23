import type { ReactNode } from "react";
import PackageSection from "./PackageSection";
import ItineraryTimeline from "./ItineraryTimeline";
import type { PlanTripResponse } from "../../models/trip";
type Props = {
  result: PlanTripResponse | null;
  /** Per-trip actions (PDF / Share), rendered in the card header so
   *  they're visible the moment the plan appears -- not at the very
   *  bottom of the chat, behind the prompt box. */
  actions?: ReactNode;
};

export default function TripResult({ result, actions }: Props) {
  if (!result) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface-raised p-14 text-center shadow-soft animate-fadeIn">
        <h2 className="text-2xl font-semibold text-ink">
          Ready to plan your next adventure?
        </h2>

        <p className="mx-auto mt-4 max-w-xl leading-7 text-ink-muted">
          Describe your destination, travel dates, budget, number of travelers,
          and preferences. TravelMaster will search flights, hotels,
          attractions, and weather to build a personalized itinerary.
        </p>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="mt-10 rounded-3xl border border-red-200 bg-red-50 p-8 shadow-soft animate-fadeIn">
        <h2 className="text-2xl font-semibold text-red-700">
          Unable to plan your trip
        </h2>

        <p className="mt-3 leading-7 text-red-600">
          {result.message}
        </p>
      </div>
    );
  }

  const trip = result.trip;
  if (!trip) {
  return (
    <div className="mt-10 rounded-3xl border border-red-200 bg-red-50 p-8 shadow-soft animate-fadeIn">
      <h2 className="text-2xl font-semibold text-red-700">
        Unable to load trip data
      </h2>

      <p className="mt-3 leading-7 text-red-600">
        The trip response was incomplete.
      </p>
    </div>
  );
}
  // A clarification turn ("which dates?") still produces a trip object,
  // just an empty one -- which rendered the "Your Trip Plan" header with
  // nothing underneath it. If there is nothing to show, show nothing.
  const hasAnything =
    (trip.multi_itineraries?.length ?? 0) > 0 ||
    (trip.places?.length ?? 0) > 0 ||
    Boolean(trip.weather) ||
    Boolean(trip.recommended);

  if (!hasAnything) return null;

  return (
    <div className="animate-fadeIn overflow-hidden rounded-3xl border border-border bg-surface-raised p-6 sm:p-7 lg:p-8 shadow-raised">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:mb-8">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
            Your Trip Plan
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Flights, hotels, attractions and weather have been organized below.
          </p>
        </div>

        {actions && <div className="w-full shrink-0 sm:w-auto">{actions}</div>}
      </div>
      <div className="space-y-6">
        <PackageSection
          packages={trip.multi_itineraries ?? []}
          recommendedProfile={trip.recommended?.profile}
          places={trip.places}
          weather={trip.weather}
        />
      </div>

      <ItineraryTimeline trip={trip} />
    </div>
  );
}