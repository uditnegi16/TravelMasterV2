import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceInputState } from "./voice.types";

// Web Speech API isn't part of TypeScript's standard DOM lib (still
// non-standard/experimental across browsers) -- minimal types for
// exactly the subset used here, replacing what were previously `any`.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface UseVoiceInputOptions {
  /** Called with the final transcript once recording stops and text is ready */
  onResult: (transcript: string) => void;
  /**
   * Called when the browser has no Web Speech API support (e.g. Firefox,
   * most non-Chromium browsers). Should upload the captured audio blob to
   * your backend's Whisper endpoint and resolve with the transcript.
   */
  transcribeWithWhisper?: (audioBlob: Blob) => Promise<string>;
}

/**
 * Drives the mic button + status panel. Prefers the browser's native
 * SpeechRecognition; falls back to MediaRecorder + server-side Whisper
 * transcription when that API isn't available.
 */
/** Collapses repeated whitespace and trims. */
function squashSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function useVoiceInput({ onResult, transcribeWithWhisper }: UseVoiceInputOptions) {
  const [voice, setVoice] = useState<VoiceInputState>({ state: "idle" });
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Chrome ends recognition after a few seconds of silence even with
  // continuous = true, so a pause to think used to submit the
  // sentence and stop. This tracks whether the USER asked to stop,
  // so an automatic end can be restarted instead of ending dictation.
  const shouldKeepListeningRef = useRef(false);

  // onresult only reports results from event.resultIndex onward, so
  // each callback carried just the newest segment. Assigning it
  // straight to state overwrote everything said before -- the reason
  // earlier speech vanished mid-dictation.
  const finalTranscriptRef = useRef("");

  const hasNativeSpeech =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startTimer = useCallback(() => {
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      setVoice((v) => ({ ...v, elapsedSeconds: (Date.now() - startedAt) / 1000 }));
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const beginNativeListening = useCallback(() => {
    const SpeechRecognitionImpl = (
      window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).SpeechRecognition ?? (
      window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }
    ).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionImpl!();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";
      let newlyFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) newlyFinal += transcript;
        else interim += transcript;
      }

      if (newlyFinal) {
        // Browsers often prefix a transcript with a space, so joining
        // naively yields "a trip  to Paris". Collapse runs of
        // whitespace rather than trusting either side.
        finalTranscriptRef.current = squashSpaces(
          `${finalTranscriptRef.current} ${newlyFinal}`,
        );
      }

      // Everything finalised so far, plus whatever is being said
      // right now, so the box shows the full sentence.
      setVoice((v) => ({
        ...v,
        interimTranscript: squashSpaces(
          `${finalTranscriptRef.current} ${interim}`,
        ),
      }));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      shouldKeepListeningRef.current = false;
      stopTimer();
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoice({ state: "permission-denied" });
        setPermissionModalOpen(true);
      } else {
        setVoice({ state: "error", errorMessage: "We couldn't hear anything. Please try again." });
      }
    };

    recognition.onend = () => {
      // Chrome ends on silence, not only when asked. If the user has
      // not pressed stop, resume rather than cutting them off
      // mid-thought.
      if (shouldKeepListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Already restarting, or the engine refused. Fall
          // through and finish cleanly rather than hanging.
        }
      }

      stopTimer();
      const collected = finalTranscriptRef.current.trim();
      setVoice((current) => {
        if (current.state === "listening" && (collected || current.interimTranscript)) {
          onResult(collected || current.interimTranscript!);
          return { state: "idle" };
        }
        return current.state === "listening" ? { state: "idle" } : current;
      });
    };

    recognitionRef.current = recognition;
    finalTranscriptRef.current = "";
    shouldKeepListeningRef.current = true;
    recognition.start();
    setVoice({ state: "listening", elapsedSeconds: 0 });
    startTimer();
  }, [onResult, startTimer, stopTimer]);

  const beginWhisperFallback = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stopTimer();
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoice({ state: "processing", usingWhisperFallback: true });
        try {
          const transcript = await transcribeWithWhisper?.(blob);
          setVoice({ state: "idle" });
          if (transcript) onResult(transcript);
        } catch {
          setVoice({ state: "error", errorMessage: "Transcription failed. Please try again." });
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setVoice({ state: "listening", elapsedSeconds: 0 });
      startTimer();
    } catch {
      setVoice({ state: "permission-denied" });
      setPermissionModalOpen(true);
    }
  }, [onResult, startTimer, stopTimer, transcribeWithWhisper]);

  const start = useCallback(async () => {
    setVoice({ state: "requesting-permission" });

    try {
      // Trigger the permission prompt up front so the mic button reflects
      // "requesting-permission" while the browser dialog is open.
      if (navigator.permissions) {
        const status = await navigator.permissions
          .query({ name: "microphone" as PermissionName })
          .catch(() => null);
        if (status?.state === "denied") {
          setVoice({ state: "permission-denied" });
          setPermissionModalOpen(true);
          return;
        }
      }

      if (hasNativeSpeech) {
        beginNativeListening();
      } else {
        await beginWhisperFallback();
      }
    } catch {
      setVoice({ state: "error", errorMessage: "Something went wrong starting the microphone." });
    }
  }, [beginNativeListening, beginWhisperFallback, hasNativeSpeech]);

  const stop = useCallback(() => {
    // Disarm before stopping, or onend would immediately restart.
    shouldKeepListeningRef.current = false;
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (voice.state === "listening") stop();
    else if (voice.state === "idle" || voice.state === "error") void start();
  }, [voice.state, start, stop]);

  const retryAfterDenied = useCallback(() => {
    setPermissionModalOpen(false);
    void start();
  }, [start]);

  useEffect(() => stopTimer, [stopTimer]);

  return {
    voice,
    toggle,
    stop,
    permissionModalOpen,
    setPermissionModalOpen,
    retryAfterDenied,
  };
}
