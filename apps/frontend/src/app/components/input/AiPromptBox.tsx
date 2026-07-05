import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Mic, ArrowUp, Sparkles } from "lucide-react";
import { cn } from "../../../lib/cn";

interface AiPromptBoxProps {
  size?: "hero" | "compact";
  placeholder?: string;
  onSubmit?: (value: string) => void;
  className?: string;
}

export function AiPromptBox({
  size = "hero",
  placeholder = "Plan a 5-day trip to Kyoto under $1,200...",
  onSubmit,
  className,
}: AiPromptBoxProps) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);

  const isHero = size === "hero";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit?.(value.trim());
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  // Voice button is UI-only for now — toggles a visual "listening" state,
  // no Web Speech API wiring yet (that lands with backend hookup).
  function handleVoiceClick() {
    setListening((v) => !v);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "group relative flex w-full items-end gap-2 rounded-2xl border border-border-strong bg-white p-2.5 shadow-card transition-all duration-200 focus-within:border-brand/50 focus-within:shadow-raised",
        isHero ? "pl-5" : "pl-4",
        className
      )}
    >
      {isHero && (
        <span className="mb-2.5 flex h-6 w-6 shrink-0 items-center justify-center text-brand">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
      )}

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={isHero ? 2 : 1}
        placeholder={placeholder}
        className={cn(
          "min-h-[28px] flex-1 resize-none bg-transparent text-ink placeholder:text-ink-faint focus:outline-none",
          isHero ? "py-2.5 text-md md:text-lg" : "py-2 text-base"
        )}
      />

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={handleVoiceClick}
          aria-label={listening ? "Stop voice input" : "Use voice input"}
          aria-pressed={listening}
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-full transition-all duration-150 focus-ring",
            isHero ? "h-11 w-11" : "h-9 w-9",
            listening
              ? "bg-brand-soft text-brand"
              : "bg-surface-sunken text-ink-muted hover:text-ink hover:bg-surface-subtle"
          )}
        >
          {listening && (
            <span className="absolute inset-0 rounded-full bg-brand/15 animate-pulseSoft" />
          )}
          <Mic className={isHero ? "h-[18px] w-[18px]" : "h-4 w-4"} strokeWidth={2} />
        </button>

        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Send"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-ink text-white transition-all duration-150 hover:bg-black active:scale-[0.94] disabled:bg-surface-sunken disabled:text-ink-faint focus-ring",
            isHero ? "h-11 w-11" : "h-9 w-9"
          )}
        >
          <ArrowUp className={isHero ? "h-[18px] w-[18px]" : "h-4 w-4"} strokeWidth={2.25} />
        </button>
      </div>
    </form>
  );
}
