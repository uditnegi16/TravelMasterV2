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

export async function createOrder(token: string): Promise<CreateOrderResponse> {
  const response = await fetch(`${API_URL}/payments/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to create payment order.");
  }

  return response.json();
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function verifyPayment(
  token: string,
  payload: VerifyPaymentPayload,
): Promise<{ verified: boolean; message: string }> {
  const response = await fetch(`${API_URL}/payments/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Payment verification failed.");
  }

  return response.json();
}