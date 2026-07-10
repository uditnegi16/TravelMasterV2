import {
  Briefcase,
  Heart,
  Wallet,
  Users,
  Mountain,
  Sparkles,
} from "lucide-react";

const styles = [
  { icon: Wallet, title: "Budget", desc: "Maximum value within your budget." },
  { icon: Sparkles, title: "Luxury", desc: "Premium hotels and experiences." },
  { icon: Heart, title: "Honeymoon", desc: "Romantic, curated itineraries." },
  { icon: Users, title: "Family", desc: "Kid-friendly planning and stays." },
  { icon: Briefcase, title: "Business", desc: "Efficient work travel." },
  { icon: Mountain, title: "Adventure", desc: "Nature and outdoor trips." },
];

export function TravelStyles() {
  return (
    <section className="bg-surface-subtle py-20 md:py-28">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="max-w-[640px]">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            Travel Styles
          </p>

          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Plans built around how you travel.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {styles.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="card-surface flex gap-4 p-6 hover:shadow-raised transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <Icon className="h-6 w-6" />
              </div>

              <div>
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}