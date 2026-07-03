import { useState } from "react";

import Hero from "../../components/trip/Hero";
import FeaturePills from "../../components/trip/FeaturePills";
import TripInput from "../../components/input/TripInput";
import TripResult from "../../components/trip/TripResult";

import { planTrip } from "../../services/api";

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const loadingMessages = [
    "✈ Searching Flights...",
    "🏨 Finding Hotels...",
    "📍 Discovering Places...",
    "🌦 Checking Weather...",
    "🤖 Building your itinerary..."
  ];
  async function handleSubmit(query: string) {
    try {
      setLoading(true);

      const response = await planTrip(query);

      setResult(response);
    } catch (e) {
      console.error(e);
      setResult({
        error: true,
        message:
          "We couldn't generate your trip. Please try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <Hero />

      <FeaturePills />

      <TripInput
        loading={loading}
        onSubmit={handleSubmit}
      />

      <TripResult result={result} />
    </div>
  );
}