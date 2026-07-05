import { Chip } from "../ui/Chip";
export default function FeaturePills() {
  const items = [
    "AI Planner",
    "Flights",
    "Hotels",
    "Weather",
    "Places",
    "Itinerary",
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        margin: "30px 0",
      }}
    >
      {items.map((item) => (
        <Chip key={item}>
          {item}
        </Chip>
      ))}
    </div>
  );
}