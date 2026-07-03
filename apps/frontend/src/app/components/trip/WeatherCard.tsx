import { CloudSun } from "lucide-react";

type Props = {
  weather: any;
};

export default function WeatherCard({ weather }: Props) {
  if (!weather) return null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 20,
      }}
    >
      <CloudSun size={22} />

      <h3>{weather.city}</h3>

      <p>{weather.temperature}°C</p>
    </div>
  );
}