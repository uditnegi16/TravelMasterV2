import { CloudSun } from "lucide-react";

type Props = {
  weather: any;
};

export default function WeatherCard({ weather }: Props) {
  if (!weather) return null;

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-greenSoft text-accent-green">
          <CloudSun className="h-5 w-5" />
        </span>

        <div>
          <h3 className="text-lg font-semibold text-ink">
            {weather.city || weather.location || "Destination"}
          </h3>

          <p className="text-sm text-ink-muted">
            {weather.condition || "Current Weather"}
          </p>
        </div>
      </div>

      <p className="mt-6 font-mono text-3xl font-semibold text-ink">
        {weather.temperature ?? "--"}°C
      </p>
    </div>
  );
}