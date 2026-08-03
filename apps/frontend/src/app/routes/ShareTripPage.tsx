import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../services/api";
import TripResult from "../components/trip/TripResult";
import type { SharedTripResponse } from "../models/trip";

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; data: SharedTripResponse }
  | { status: "unavailable" } // matches Issue 3's real 410: expired, revoked, or invalid token
  | { status: "error" }; // network failure, unexpected server error

export default function ShareTripPage() {
  const { token } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetch(`${API_URL}/chat/share/${token}`)
      .then((response) => {
        if (cancelled) return;
        if (response.status === 410) {
          setState({ status: "unavailable" });
          return;
        }
        if (!response.ok) {
          setState({ status: "error" });
          return;
        }
        return response.json().then((data: SharedTripResponse) => {
          if (!cancelled) setState({ status: "loaded", data });
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite" className="p-10 text-center text-lg">
        Loading shared trip...
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div role="alert" className="p-10 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-ink">
          This shared trip is no longer available
        </h1>
        <p className="text-ink-muted">
          The link may have expired, been revoked by its owner, or never existed.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className="p-10 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-ink">
          Couldn't load this trip
        </h1>
        <p className="text-ink-muted">Please check your connection and try again.</p>
      </div>
    );
  }

  const { data } = state;

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