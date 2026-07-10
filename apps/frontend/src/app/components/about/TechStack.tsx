const stack = [
  { label: "React + Vite", note: "Frontend" },
  { label: "Node.js", note: "Backend runtime" },
  { label: "PostgreSQL", note: "Trip & user data" },
  { label: "Claude AI", note: "Planning agent" },
  { label: "Whisper", note: "Voice transcription" },
  { label: "Razorpay", note: "Payments" },
  { label: "WebSockets", note: "Live streaming replies" },
  { label: "Tailwind CSS", note: "Design system" },
];

export function TechStack() {
  return (
    <section className="bg-surface-subtle py-16 md:py-20">
      <div className="mx-auto max-w-[1080px] px-4 md:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            Technology
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            Built on a modern, reliable stack
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stack.map((item) => (
            <div
              key={item.label}
              className="card-surface bg-white px-5 py-6 text-center"
            >
              <p className="font-mono text-sm font-semibold text-ink">
                {item.label}
              </p>
              <p className="mt-1.5 text-xs text-ink-faint">{item.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
