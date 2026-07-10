import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import TripResult from "../components/trip/TripResult";
import type { SharedTripResponse } from "../models/trip";

export default function ShareTripPage() {
  const { token } = useParams();

  const [data, setData] = useState<SharedTripResponse | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`http://localhost:8000/chat/share/${token}`)
      .then((r) => r.json())
      .then(setData);
  }, [token]);

  if (!data) {
    return (
      <div className="p-10 text-center text-lg">
        Loading shared trip...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-6 text-4xl font-bold">
        Shared TravelMaster Trip
      </h1>

      <p className="mb-8 whitespace-pre-wrap">
        {data.summary}
      </p>

      <TripResult
        result={{
          trip: data.trip,
        }}
      />
    </div>
  );
}