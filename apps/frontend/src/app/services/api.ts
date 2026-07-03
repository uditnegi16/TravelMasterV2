const API_URL = "http://127.0.0.1:8000";

export async function planTrip(query: string) {
  const response = await fetch(`${API_URL}/plan-trip`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to plan trip.");
  }

  return response.json();
}