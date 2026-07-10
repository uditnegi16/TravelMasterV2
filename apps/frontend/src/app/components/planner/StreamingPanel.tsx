type StreamingPanelProps = {
  text: string;
};

export default function StreamingPanel({
  text,
}: StreamingPanelProps) {
  if (!text) return null;

  return (
    <section className="card-surface animate-fadeIn p-7">

      <div className="mb-5 flex items-center gap-3">

        <span className="h-2.5 w-2.5 rounded-full bg-brand animate-pulse" />

        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
          Live AI Response
        </span>

      </div>

      <p className="whitespace-pre-wrap leading-8 text-ink-muted">
        {text}
        <span className="animate-pulse">▍</span>
      </p>

    </section>
  );
}