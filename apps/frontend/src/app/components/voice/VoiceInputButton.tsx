import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../../../lib/cn";
import type { VoiceState } from "./voice.types";

interface VoiceInputButtonProps {
  state: VoiceState;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const sizeMap = {
  sm: { btn: "h-9 w-9", icon: "h-4 w-4" },
  md: { btn: "h-11 w-11", icon: "h-[18px] w-[18px]" },
  lg: { btn: "h-14 w-14", icon: "h-6 w-6" },
};

export function VoiceInputButton({
  state,
  onClick,
  size = "md",
  disabled,
}: VoiceInputButtonProps) {
  const dims = sizeMap[size];
  const isListening = state === "listening";
  const isProcessing = state === "processing" || state === "requesting-permission";
  const isError = state === "permission-denied" || state === "error";

  const label = isListening
    ? "Stop recording"
    : isProcessing
    ? "Listening request in progress"
    : isError
    ? "Microphone unavailable, tap to retry"
    : "Use voice input";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isProcessing}
      aria-label={label}
      aria-pressed={isListening}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full transition-all duration-150 focus-ring disabled:cursor-not-allowed",
        dims.btn,
        isListening
          ? "bg-accent-red text-white shadow-soft"
          : isError
          ? "bg-accent-redSoft text-accent-red"
          : isProcessing
          ? "bg-brand-soft text-brand"
          : "bg-surface-sunken text-ink-muted hover:text-ink hover:bg-surface-subtle"
      )}
    >
      {isListening && (
        <>
          <span className="absolute inset-0 rounded-full bg-accent-red/25 animate-ping" />
          <span className="absolute -inset-1.5 rounded-full border border-accent-red/30 animate-pulseSoft" />
        </>
      )}

      {isListening ? (
        <Square className={dims.icon} strokeWidth={2.25} fill="currentColor" />
      ) : isProcessing ? (
        <Loader2 className={cn(dims.icon, "animate-spin")} strokeWidth={2.25} />
      ) : isError ? (
        <AlertCircle className={dims.icon} strokeWidth={2.25} />
      ) : (
        <Mic className={dims.icon} strokeWidth={2} />
      )}
    </button>
  );
}
