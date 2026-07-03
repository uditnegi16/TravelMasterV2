import { MapPin } from "lucide-react";

type Props = {
  place: any;
};

export default function PlaceCard({ place }: Props) {
  if (!place) return null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <MapPin size={22} />

      <h3>{place.name}</h3>

      <a
        href={place.maps_url}
        target="_blank"
        rel="noreferrer"
      >
        Open Maps
      </a>
    </div>
  );
}