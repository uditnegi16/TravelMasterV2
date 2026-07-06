export const API_URL = "http://127.0.0.1:8000";
import type { PlanTripResponse, Trip } from "../models/trip";

export async function planTrip(
  query: string,
  sessionId: string,
): Promise<PlanTripResponse> {
  const response = await fetch(`${API_URL}/plan-trip`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      session_id: sessionId,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to plan trip.");
  }

  return response.json();
}

// Objective 5.4 — Async PDF Generation.
// Fire-and-forget: kicks off background PDF rendering on the backend.
// The actual "ready"/"error" transition arrives later over the
// existing /ws/progress/{session_id} socket as a "pdf" stage event,
// not from this response.
export async function generatePdf(
  sessionId: string,
  trip: Trip,
){
  const response = await fetch(`${API_URL}/generate-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: sessionId,
      trip,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to start PDF generation.");
  }

  return response.json();
}

export interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export async function createOrder(): Promise<CreateOrderResponse> {
  const response = await fetch(`${API_URL}/payments/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to create payment order.");
  }

  return response.json();
}