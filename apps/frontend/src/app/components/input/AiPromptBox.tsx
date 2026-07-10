import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Mic, ArrowUp, Sparkles } from "lucide-react";
import { VoiceStatusPanel } from "../voice/VoiceStatusPanel";
import { VoicePermissionModal } from "../voice/VoicePermissionModal";
import { cn } from "../../../lib/cn";
import { useVoiceInput } from "../voice/useVoiceInput";
interface AiPromptBoxProps {
  size?: "hero" | "compact";
  placeholder?: string;
  onSubmit?: (value: string) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
}

export function AiPromptBox({
  size = "hero",
  placeholder = "Plan a 5-day trip to Kyoto under $1,200...",
  onSubmit,
  className,
  disabled = false,
}: AiPromptBoxProps) {
  const [value, setValue] = useState("");
    const {
  voice,
  toggle,
  permissionModalOpen,
  setPermissionModalOpen,
  retryAfterDenied,
} = useVoiceInput({
  onResult: (transcript: string) => {
    setValue((current) =>
      current ? `${current} ${transcript}` : transcript
    );
  },

  transcribeWithWhisper: async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice.webm");

    const response = await fetch(
      `${import.meta.env.VITE_API_BASE}/voice/transcribe`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Whisper transcription failed.");
    }

    const { transcript } = await response.json();
    return transcript;
  },
});
  // Guards against a second submit firing (double Enter, double click,
  // or a stray click landing before the button's disabled state
  // re-renders) while the previous message is still being sent.
  const [submitting, setSubmitting] = useState(false);
  // React state updates aren't synchronous, so two submits fired in the
  // same tick (e.g. Enter + a click landing before re-render) could both
  // read stale `submitting` state. The ref is checked/set immediately,
  // so the second call always sees the first one already in flight.
  const submittingRef = useRef(false);

  const isHero = size === "hero";
  const isBusy = disabled || submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled || submittingRef.current) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    submittingRef.current = true;
    setSubmitting(true);
    setValue("");
    try {
      await onSubmit?.(trimmed);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isBusy) return;
      void handleSubmit(e);
    }
  }

  // Voice button is UI-only for now — toggles a visual "listening" state,
  // no Web Speech API wiring yet (that lands with backend hookup).
  function handleVoiceClick() {
    toggle();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "group relative flex w-full flex-col gap-3 rounded-2xl border border-border-strong bg-white p-3 shadow-card transition-all duration-200 focus-within:border-brand/50 focus-within:shadow-raised sm:flex-row sm:items-end sm:gap-2 sm:p-2.5",
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
      style={{
          maxHeight: "180px",
        }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={isHero ? 2 : 1}
        placeholder={placeholder}
        disabled={isBusy}
        className={cn(
          "min-h-[48px] w-full flex-1 resize-none overflow-y-auto bg-transparent text-ink placeholder:text-ink-faint focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
          isHero ? "py-2.5 text-md md:text-lg" : "py-2 text-base"
        )}
      />

      <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto sm:items-center">
        <button
          type="button"
          onClick={handleVoiceClick}
          disabled={isBusy}
          aria-label={
            voice.state === "listening"
              ? "Stop voice input"
              : "Use voice input"
          }
          aria-pressed={voice.state === "listening"}
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-full transition-all duration-150 focus-ring disabled:cursor-not-allowed disabled:opacity-60",
            isHero ? "h-11 w-11" : "h-9 w-9",
            voice.state === "listening"
              ? "bg-brand-soft text-brand"
              : "bg-surface-sunken text-ink-muted hover:text-ink hover:bg-surface-subtle"
          )}
        >
          {voice.state === "listening" && (
            <span className="absolute inset-0 rounded-full bg-brand/15 animate-pulseSoft" />
          )}
          <Mic className={isHero ? "h-[18px] w-[18px]" : "h-4 w-4"} strokeWidth={2} />
        </button>

        <button
          type="submit"
          disabled={!value.trim() || isBusy}
          aria-label="Send"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-ink text-white transition-all duration-150 hover:bg-black active:scale-[0.94] disabled:bg-surface-sunken disabled:text-ink-faint focus-ring",
            isHero ? "h-11 w-11" : "h-9 w-9"
          )}
        >
          <ArrowUp className={isHero ? "h-[18px] w-[18px]" : "h-4 w-4"} strokeWidth={2.25} />
        </button>
      </div>
      <>
      <VoiceStatusPanel
        voice={voice}
        onStop={toggle}
      />

      <VoicePermissionModal
        open={permissionModalOpen}
        denied={voice.state === "permission-denied"}
        onAllow={retryAfterDenied}
        onRetry={retryAfterDenied}
        onCancel={() => setPermissionModalOpen(false)}
      />
    </>
    </form>
  );
}