type StreamingPanelProps = {
  text: string;
};

export default function StreamingPanel({
  text,
}: StreamingPanelProps) {
  if (!text) return null;

  return (
    <div className="mt-8 animate-fadeIn rounded-3xl border border-border bg-white p-6 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />

        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
          AI Response
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-7 text-ink-muted">
        {text}
        <span className="animate-pulse">▍</span>
      </p>
    </div>
  );
}