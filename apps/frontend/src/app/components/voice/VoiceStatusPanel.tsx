import { AnimatePresence, motion } from "framer-motion";
import { Square, Sparkles, AlertTriangle } from "lucide-react";
import { VoiceWaveform } from "./VoiceWaveform";
import type { VoiceInputState } from "./voice.types";

interface VoiceStatusPanelProps {
  voice: VoiceInputState;
  onStop: () => void;
  onRetry?: () => void;
}

function formatTime(totalSeconds = 0) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceStatusPanel({ voice, onStop, onRetry }: VoiceStatusPanelProps) {
  const visible =
    voice.state === "listening" ||
    voice.state === "processing" ||
    voice.state === "error";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="mt-2 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-subtle px-4 py-3">
            {voice.state === "listening" && (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <VoiceWaveform active bars={5} />
                  <p className="truncate text-sm text-ink-muted">
                    {voice.interimTranscript ? (
                      <span className="text-ink">{voice.interimTranscript}</span>
                    ) : (
                      "Listening…"
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-ink-faint">
                    {formatTime(voice.elapsedSeconds)}
                  </span>
                  <button
                    type="button"
                    onClick={onStop}
                    className="focus-ring flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white transition-transform active:scale-[0.96]"
                  >
                    <Square className="h-3 w-3" fill="currentColor" />
                    Stop
                  </button>
                </div>
              </>
            )}

            {voice.state === "processing" && (
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <Sparkles className="h-4 w-4 animate-pulseSoft text-brand" />
                </span>
                {voice.usingWhisperFallback
                  ? "Transcribing with AI (Whisper fallback)…"
                  : "Converting speech to text…"}
              </div>
            )}

            {voice.state === "error" && (
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-accent-red">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {voice.errorMessage ?? "We couldn't hear anything. Please try again."}
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="focus-ring shrink-0 rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-white"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
