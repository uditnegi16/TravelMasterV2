import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";

import App from "./App";
import "./styles/globals.css";
// --- ElevenLabs voice sidecar (feat/voice-agent) ---
// The one addition this feature makes to any existing frontend file.
// Removal: delete src/voice-agent/, delete this import + the one
// <VoiceAgentMount /> line below.
import { VoiceAgentMount } from "./voice-agent";
import { initTheme } from "./lib/useTheme";

// Before first paint, so a dark-theme user never sees a white flash.
initTheme();

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <VoiceAgentMount />
    </ClerkProvider>
  </React.StrictMode>
);