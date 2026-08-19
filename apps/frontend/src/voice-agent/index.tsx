import { lazy, Suspense } from "react";

const LazyVoiceAgentWidget = lazy(() => import("./VoiceAgentWidget"));

/**
 * The one thing main.tsx needs to know about. Flag-gated here, not
 * just at the widget's own render -- when VITE_VOICE_ENABLED isn't
 * "true", VoiceAgentWidget.tsx is never even fetched (real lazy
 * loading, not just conditionally rendering an already-downloaded
 * component).
 */
export function VoiceAgentMount() {
  if (import.meta.env.VITE_VOICE_ENABLED !== "true") return null;

  return (
    <Suspense fallback={null}>
      <LazyVoiceAgentWidget />
    </Suspense>
  );
}
