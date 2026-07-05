import FlightCard from "./FlightCard";
import HotelCard from "./HotelCard";
import PlaceCard from "./PlaceCard";
import ResponseTabs from "./ResponseTabs";
import WeatherCard from "./WeatherCard";

type Props = {
  result: any;
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

  return (
    <div className="mt-10 animate-fadeIn rounded-3xl border border-border bg-white p-7 shadow-raised">
      <div className="mb-7">
        <h2 className="font-display text-3xl font-semibold text-ink">
          Your Trip Plan
        </h2>

        <p className="mt-2 text-sm text-ink-muted">
          Flights, hotels, attractions and weather have been organized below.
        </p>
      </div>

      <ResponseTabs>
        {[
          <div key="summary">
            <h3 className="text-xl font-semibold text-ink">
              Trip Summary
            </h3>

            <p className="mt-4 leading-8 text-ink-muted">
              {trip.summary}
            </p>
          </div>,

          trip.recommended?.flight ? (
            <FlightCard
              key="flight"
              flight={trip.recommended.flight}
            />
          ) : (
            <p key="flight" className="text-ink-muted">
              No flight recommendations available.
            </p>
          ),

          trip.recommended?.hotel ? (
            <HotelCard
              key="hotel"
              hotel={trip.recommended.hotel}
            />
          ) : (
            <p key="hotel" className="text-ink-muted">
              No hotel recommendations available.
            </p>
          ),

          <div key="places" className="space-y-4">
            {trip.places?.length ? (
              trip.places.map((place: any, index: number) => (
                <PlaceCard
                  key={index}
                  place={place}
                />
              ))
            ) : (
              <p className="text-ink-muted">
                No attractions available.
              </p>
            )}
          </div>,

          <WeatherCard
            key="weather"
            weather={trip.weather}
          />,
        ]}
      </ResponseTabs>
    </div>
  );
}