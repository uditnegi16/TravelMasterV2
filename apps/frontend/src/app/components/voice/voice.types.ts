export type VoiceState =
  | "idle"
  | "requesting-permission"
  | "permission-denied"
  | "listening"
  | "processing"
  | "error";

export interface VoiceInputState {
  state: VoiceState;
  /** Live interim transcript while listening (Web Speech API) */
  interimTranscript?: string;
  /** Seconds elapsed since recording started */
  elapsedSeconds?: number;
  /** True when falling back to server-side Whisper transcription
   *  instead of the browser's native Web Speech API */
  usingWhisperFallback?: boolean;
  errorMessage?: string;
}
