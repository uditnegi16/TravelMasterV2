import { Sparkles, MapPin, Plane, Utensils } from "lucide-react";

const suggestions = [
  { icon: Plane, text: "5 days in Kyoto under $1,200" },
  { icon: MapPin, text: "Weekend trip near Goa for two" },
  { icon: Utensils, text: "Food-focused week in Bangkok" },
];

interface EmptyChatProps {
  onSuggestionClick?: (text: string) => void;
}

export function EmptyChat({ onSuggestionClick }: EmptyChatProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Sparkles className="h-6 w-6" strokeWidth={2} />
      </span>

      <h2 className="mt-5 font-display text-2xl font-bold text-ink">
        Where to, next?
      </h2>

      <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ink-muted">
        Describe a trip in plain language, or tap the mic to speak it. Your
        chat history will show up here.
      </p>

      <div className="mt-8 flex w-full max-w-[440px] flex-col gap-2.5">
        {suggestions.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => onSuggestionClick?.(s.text)}
            className="focus-ring group flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-left text-sm text-ink transition-all hover:border-brand/40 hover:bg-brand-softer"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink-muted transition-colors group-hover:bg-brand-soft group-hover:text-brand">
              <s.icon className="h-[15px] w-[15px]" strokeWidth={2.25} />
            </span>
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
}
