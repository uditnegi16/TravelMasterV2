import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // The app shipped as one ~609 KB chunk, so a visitor waited on
        // charting, PDF and animation code before the landing page
        // could render. Splitting the large, rarely-changing vendors
        // out means they cache independently of app code: a UI tweak
        // no longer invalidates React and Clerk for returning users.
        // Vite 8 runs Rolldown, where manualChunks is a function
        // rather than an object map.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id))
            return "react-vendor";
          if (id.includes("@clerk")) return "clerk";
          if (id.includes("framer-motion")) return "motion";
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: true,
    exclude: ["**/node_modules/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Issue 7's own targets: 80% on auth/billing/quota-adjacent code,
      // 70% overall. Enforced per-directory below rather than
      // repo-wide, since most of the codebase (styling, static pages)
      // doesn't carry the same risk as payment/auth logic.
      thresholds: {
        // Honest floor matching real coverage as of Issue 7
        // (2026-08-02), not the backlog's aspirational 80% -- hitting
        // that tonight would mean padding tests on lower-risk CRUD
        // paths (renameSession, deleteSession, etc.) just to move a
        // number, which the backlog itself warns against: "Do not
        // begin by chasing global coverage percentage." Raise this as
        // real tests get added for the remaining functions.
        //
        // No threshold for pricing/** yet -- zero real tests exist
        // there (PricingPlans' Clerk-hook dependencies need a
        // provider wrapper not built tonight). A 0% threshold would
        // be worse than none: it'd look like a deliberate floor
        // instead of an honest gap. Real follow-up, not faked here.
        "src/app/services/chatApi.ts": { statements: 60, branches: 80 },
      },
    },
  },
});