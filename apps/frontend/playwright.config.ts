import { defineConfig, devices } from "@playwright/test";

// Runs against the local Vite dev server, not a "preview deployment" --
// the backlog names Playwright smoke tests "against a preview
// deployment," but no preview-environment infrastructure exists for
// this project yet (Amplify branch previews aren't configured). This
// is the honest, achievable version: real browser, real rendered app,
// against a server this config starts itself.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
