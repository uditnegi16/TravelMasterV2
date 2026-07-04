import { useState } from "react";

import Hero from "../../components/trip/Hero";
import FeaturePills from "../../components/trip/FeaturePills";
import TripInput from "../../components/input/TripInput";
import TripResult from "../../components/trip/TripResult";
import PremiumCard from "../../components/payment/PremiumCard";
import { planTrip } from "../../services/api";

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
 
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

      <PremiumCard />

      <TripInput
        loading={loading}
        onSubmit={handleSubmit}
      />

      <TripResult result={result} />
    </div>
  );
}