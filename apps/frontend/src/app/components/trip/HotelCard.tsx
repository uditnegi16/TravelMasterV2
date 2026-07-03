import { Hotel } from "lucide-react";

type Props = {
  hotel: any;
};

export default function HotelCard({ hotel }: Props) {
  if (!hotel) return null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 20,
        background: "#fff",
      }}
    >
      <Hotel size={22} />

      <h3>{hotel.city}</h3>

      <a
        href={hotel.booking_url}
        target="_blank"
        rel="noreferrer"
      >
        View Hotels
      </a>
    </div>
  );
}