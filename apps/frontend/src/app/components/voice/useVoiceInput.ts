import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceInputState } from "./voice.types";

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
export function useVoiceInput({ onResult, transcribeWithWhisper }: UseVoiceInputOptions) {
  const [voice, setVoice] = useState<VoiceInputState>({ state: "idle" });
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

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
    const SpeechRecognitionImpl =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      setVoice((v) => ({ ...v, interimTranscript: final || interim }));
    };

    recognition.onerror = (event: any) => {
      stopTimer();
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoice({ state: "permission-denied" });
        setPermissionModalOpen(true);
      } else {
        setVoice({ state: "error", errorMessage: "We couldn't hear anything. Please try again." });
      }
    };

    recognition.onend = () => {
      stopTimer();
      setVoice((current) => {
        if (current.state === "listening" && current.interimTranscript) {
          onResult(current.interimTranscript);
          return { state: "idle" };
        }
        return current.state === "listening" ? { state: "idle" } : current;
      });
    };

    recognitionRef.current = recognition;
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
