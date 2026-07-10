import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, ShieldCheck, X } from "lucide-react";
import { Button } from "../ui/Button";

interface VoicePermissionModalProps {
  open: boolean;
  /** true once the browser has actually reported the permission as denied */
  denied?: boolean;
  onAllow: () => void;
  onRetry?: () => void;
  onCancel: () => void;
}

export function VoicePermissionModal({
  open,
  denied = false,
  onAllow,
  onRetry,
  onCancel,
}: VoicePermissionModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-permission-title"
            className="card-surface relative w-full max-w-[420px] p-7 shadow-raised"
          >
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="focus-ring absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-surface-subtle hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className={
                denied
                  ? "flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-redSoft text-accent-red"
                  : "flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"
              }
            >
              {denied ? (
                <MicOff className="h-6 w-6" strokeWidth={2} />
              ) : (
                <Mic className="h-6 w-6" strokeWidth={2} />
              )}
            </div>

            <h2
              id="voice-permission-title"
              className="mt-5 font-display text-xl font-bold text-ink"
            >
              {denied ? "Microphone access is blocked" : "Allow microphone access"}
            </h2>

            <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
              {denied ? (
                <>
                  TravelMaster can't hear you because microphone access was
                  denied. Enable it from your browser's site settings, then
                  try again.
                </>
              ) : (
                <>
                  TravelMaster uses your microphone only while you're
                  recording, so you can speak your trip instead of typing it.
                  Audio is transcribed and never stored.
                </>
              )}
            </p>

            {!denied && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-subtle px-3.5 py-2.5 text-xs text-ink-muted">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent-green" />
                Nothing is recorded until you tap the mic button.
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <Button variant="ghost" size="md" fullWidth onClick={onCancel}>
                Cancel
              </Button>

              {denied ? (
                <Button variant="primary" size="md" fullWidth onClick={onRetry}>
                  Try again
                </Button>
              ) : (
                <Button variant="primary" size="md" fullWidth onClick={onAllow}>
                  Allow access
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
