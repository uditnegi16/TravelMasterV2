import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";

import App from "./App";
import "./styles/globals.css";
import { initTheme } from "./lib/useTheme";
import { canonicalRedirectUrl } from "./lib/canonicalHost";

// Old Amplify address -> real domain, before anything renders (see
// lib/canonicalHost.ts). Keeps already-sent share links working.
const redirectTo = canonicalRedirectUrl(window.location);
if (redirectTo) window.location.replace(redirectTo);

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
    </ClerkProvider>
  </React.StrictMode>
);
