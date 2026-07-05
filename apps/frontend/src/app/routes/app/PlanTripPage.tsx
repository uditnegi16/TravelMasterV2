import { useState } from "react";

import { planTrip } from "../../services/api";

import { AiPromptBox } from "../../components/input/AiPromptBox";
import TripResult from "../../components/trip/TripResult";

export default function PlanTripPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleSubmit(query: string) {
    try {
      setLoading(true);

      const response = await planTrip(query);

      setResult(response);
    } catch (err: any) {
      setResult({
        error: true,
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-semibold text-ink">
            Plan Your Trip
          </h1>

          <p className="mt-3 max-w-2xl text-base text-ink-muted">
            Describe your destination, budget and travel style. TravelMaster
            will search flights, hotels, attractions and weather, then build
            your itinerary.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-raised">
          <AiPromptBox
            size="hero"
            onSubmit={handleSubmit}
            placeholder="Example: Plan a 7-day trip to Bali in August under ₹2.5 lakh..."
          />
        </div>

        {loading && (
          <div className="mt-8 rounded-3xl border border-border bg-white p-8 shadow-soft animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-brand animate-pulse"></div>
              <p className="font-medium text-ink">
                Planning your perfect trip...
              </p>
            </div>

            <div className="mt-6 space-y-3 text-sm text-ink-muted">
              <p>✈ Searching flights...</p>
              <p>🏨 Finding hotels...</p>
              <p>📍 Discovering attractions...</p>
              <p>🌤 Checking weather...</p>
              <p>🤖 Building itinerary...</p>
            </div>
          </div>
        )}

        {!loading && (
          <div className="animate-fadeIn">
            <TripResult result={result} />
          </div>
        )}
      </div>
    </div>
)
}