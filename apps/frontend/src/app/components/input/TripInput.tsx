import { useState } from "react";

type Props = {
  onSubmit: (query: string) => void;
  loading: boolean;
};

export default function TripInput({ onSubmit, loading }: Props) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    onSubmit(query);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: "12px",
        marginTop: "32px",
      }}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Plan a 5 day trip to Japan in October under ₹2 lakh..."
        style={{
          flex: 1,
          padding: "14px 16px",
          fontSize: "16px",
          borderRadius: "10px",
          border: "1px solid #d1d5db",
        }}
      />

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "14px 22px",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          background: "#2563eb",
          color: "white",
          fontWeight: 600,
        }}
      >
        {
        loading
        ? "✈ Searching Flights..."
        : "Plan Trip"
        }
      </button>
    </form>
  );
}