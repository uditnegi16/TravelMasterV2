import FlightCard from "./FlightCard";
import HotelCard from "./HotelCard";
import PlaceCard from "./PlaceCard";
import ResponseTabs from "./ResponseTabs";
import WeatherCard from "./WeatherCard";

type Props = {
  result: any;
};

export default function TripResult({ result }: Props) {
  if (!result) return null;

  if (result.error) {
    return (
      <div
        style={{
          marginTop: 32,
          padding: 24,
          borderRadius: 20,
          background: "#FEF2F2",
          border: "1px solid #FCA5A5",
        }}
      >
        <h2>Unable to plan your trip</h2>

        <p>{result.message}</p>
      </div>
    );
  }

  const trip = result.trip;

  return (
    <div
      style={{
        marginTop: 40,
        background: "#ffffff",
        borderRadius: 24,
        padding: 28,
        boxShadow: "0 10px 30px rgba(0,0,0,.06)",
      }}
    >
      <ResponseTabs>
        {[
          <div key="summary">
            <h2>Trip Summary</h2>

            <p
              style={{
                lineHeight: 1.8,
                color: "#475569",
                fontSize: 16,
              }}
            >
              {trip.summary}
            </p>
          </div>,

          <FlightCard
            key="flight"
            flight={trip.recommended.flight}
          />,

          <HotelCard
            key="hotel"
            hotel={trip.recommended.hotel}
          />,

          <div key="places">
            {trip.places?.map(
              (place: any, index: number) => (
                <PlaceCard
                  key={index}
                  place={place}
                />
              )
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