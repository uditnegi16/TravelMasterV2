import PackageCard from "./PackageCard";
import type { PackageOption, Place, Weather } from "../../models/trip";

type Props = {
  packages: PackageOption[];
  recommendedProfile?: string;
  places?: Place[];
  weather?: Weather;
};

export default function PackageSection({
  packages,
  recommendedProfile,
  places,
  weather,
}: Props) {
  if (!packages.length) return null;

  return (
    <div className="mb-8">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-ink">
          AI Recommended Packages
        </h2>

        <p className="mt-2 text-ink-muted">
          Compare the AI-generated travel packages before exploring the complete trip details.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.profile}
            pkg={pkg}
            recommended={pkg.profile === recommendedProfile}
            places={places}
            weather={weather}
          />
        ))}
      </div>
    </div>
  );
}