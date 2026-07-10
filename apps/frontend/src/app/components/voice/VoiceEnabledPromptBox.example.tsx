/**
 * Reference example — shows how to wire VoiceInputButton + VoiceStatusPanel +
 * VoicePermissionModal + useVoiceInput into a prompt box, following the same
 * shape as components/input/AiPromptBox.tsx. Not auto-imported anywhere;
 * copy the pattern into AiPromptBox.tsx once your backend exposes a Whisper
 * transcription endpoint.
 */
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { cn } from "../../../lib/cn";
import { VoiceInputButton } from "./VoiceInputButton";
import { VoiceStatusPanel } from "./VoiceStatusPanel";
import { VoicePermissionModal } from "./VoicePermissionModal";
import { useVoiceInput } from "./useVoiceInput";

interface VoiceEnabledPromptBoxProps {
  onSubmit?: (value: string) => void | Promise<void>;
  placeholder?: string;
}

async function transcribeWithWhisper(_audioBlob: Blob): Promise<string> {
  // POST to your backend, e.g. `${API_BASE}/voice/transcribe`, and return
  // the resulting text. Left as a stub here.
  return "";
}

export function VoiceEnabledPromptBox({
  onSubmit,
  placeholder = "Plan a 5-day trip to Kyoto under $1,200...",
}: VoiceEnabledPromptBoxProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const { voice, toggle, permissionModalOpen, setPermissionModalOpen, retryAfterDenied } =
    useVoiceInput({
      onResult: (transcript) => setValue((v) => (v ? `${v} ${transcript}` : transcript)),
      transcribeWithWhisper,
    });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
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
      if (!submitting) void handleSubmit(e);
    }
  }

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className={cn(
          "group relative flex w-full flex-col gap-3 rounded-2xl border border-border-strong bg-white p-3 pl-5 shadow-card transition-all duration-200 focus-within:border-brand/50 focus-within:shadow-raised sm:flex-row sm:items-end sm:gap-2 sm:p-2.5"
        )}
      >
        <span className="mb-2.5 flex h-6 w-6 shrink-0 items-center justify-center text-brand">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>

        <textarea
          style={{ maxHeight: "180px" }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={placeholder}
          disabled={submitting || voice.state === "listening"}
          className="min-h-[48px] w-full flex-1 resize-none overflow-y-auto bg-transparent py-2.5 text-md text-ink placeholder:text-ink-faint focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 md:text-lg"
        />

        <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto sm:items-center">
          <VoiceInputButton state={voice.state} onClick={toggle} size="lg" disabled={submitting} />

          <button
            type="submit"
            disabled={!value.trim() || submitting}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-all duration-150 hover:bg-black active:scale-[0.94] disabled:bg-surface-sunken disabled:text-ink-faint focus-ring"
          >
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </button>
        </div>
      </form>

      <VoiceStatusPanel voice={voice} onStop={toggle} onRetry={toggle} />

      <VoicePermissionModal
        open={permissionModalOpen}
        denied={voice.state === "permission-denied"}
        onAllow={() => {
          setPermissionModalOpen(false);
          toggle();
        }}
        onRetry={retryAfterDenied}
        onCancel={() => setPermissionModalOpen(false)}
      />
    </div>
  );
}
