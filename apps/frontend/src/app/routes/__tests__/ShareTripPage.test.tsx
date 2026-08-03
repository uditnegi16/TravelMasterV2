import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

vi.stubEnv("VITE_API_BASE", "http://test-api.local");

const ShareTripPage = (await import("../ShareTripPage")).default;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAtToken(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/share/${token}`]}>
      <Routes>
        <Route path="/share/:token" element={<ShareTripPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ShareTripPage", () => {
  it("shows a real 'no longer available' message on a 410 (expired/revoked/invalid token) -- not a broken render", async () => {
    server.use(
      http.get("http://test-api.local/chat/share/dead-token", () =>
        HttpResponse.json({ detail: "Share link expired." }, { status: 410 }),
      ),
    );

    renderAtToken("dead-token");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/no longer available/i);
    });
    // The old bug: the 410's error body would get treated as valid
    // data and the page would try to render data.summary/data.trip,
    // both undefined. Confirm that never happens.
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  it("shows a real error state on network/server failure -- not an infinite 'Loading...'", async () => {
    server.use(
      http.get("http://test-api.local/chat/share/network-fail", () => HttpResponse.error()),
    );

    renderAtToken("network-fail");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load/i);
    });
  });

  it("renders the real trip on success", async () => {
    server.use(
      http.get("http://test-api.local/chat/share/good-token", () =>
        HttpResponse.json({
          summary: "A lovely trip to Goa",
          trip: {},
        }),
      ),
    );

    renderAtToken("good-token");

    await waitFor(() => {
      expect(screen.getByText("A lovely trip to Goa")).toBeInTheDocument();
    });
  });
});
