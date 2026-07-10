import FlightCard from "./FlightCard";
import HotelCard from "./HotelCard";
import PlaceCard from "./PlaceCard";
import ResponseTabs from "./ResponseTabs";
import WeatherCard from "./WeatherCard";
import PackageSection from "./PackageSection";
import type { PlanTripResponse, Place } from "../../models/trip";
type Props = {
  result: PlanTripResponse | null;
};

export default function TripResult({ result }: Props) {
  if (!result) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-border bg-white p-14 text-center shadow-soft animate-fadeIn">
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
  return (
    <div className="animate-fadeIn overflow-hidden rounded-3xl border border-border bg-white p-6 sm:p-7 lg:p-8 shadow-raised">
      <div className="mb-6 lg:mb-8">
        <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          Your Trip Plan
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          Flights, hotels, attractions and weather have been organized below.
        </p>
      </div>
      <div className="space-y-6">
        <PackageSection
          packages={trip.multi_itineraries ?? []}
          recommendedProfile={trip.recommended?.profile}
          places={trip.places}
          weather={trip.weather}
        />
      </div>
    </div>
  );
}