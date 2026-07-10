const team = [
  { name: "Team member", role: "Founder & Engineer", initials: "TM" },
];

/**
 * Optional — render this once real team bios/photos are ready.
 * Kept intentionally minimal (initials avatar) so it's easy to fill in.
 */
export function TeamSection() {
  return (
    <section className="bg-surface-subtle py-16 md:py-20">
      <div className="mx-auto max-w-[1080px] px-4 md:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            Team
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Built by people who travel too
          </h2>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-6">
          {team.map((member) => (
            <div
              key={member.name}
              className="card-surface flex w-[220px] flex-col items-center bg-white p-6 text-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft font-display text-lg font-bold text-brand">
                {member.initials}
              </span>
              <p className="mt-4 text-sm font-semibold text-ink">{member.name}</p>
              <p className="mt-1 text-xs text-ink-faint">{member.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
