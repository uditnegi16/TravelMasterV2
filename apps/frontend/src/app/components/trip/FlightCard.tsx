import { Plane } from "lucide-react";

type Props = {
  flight: any;
};

export default function FlightCard({ flight }: Props) {
  if (!flight) return null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 20,
        background: "#fff",
      }}
    >
      <Plane size={22} />

      <h3>{flight.owner}</h3>

      <p>
        {flight.total_amount} {flight.currency}
      </p>

      <p>{flight.id}</p>
    </div>
  );
}