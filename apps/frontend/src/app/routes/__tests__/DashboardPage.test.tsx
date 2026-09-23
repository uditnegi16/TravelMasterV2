import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse, type JsonBodyType } from "msw";

vi.stubEnv("VITE_API_BASE", "http://test-api.local");
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: async () => "tok" }),
  useUser: () => ({ user: { firstName: "Aarav", imageUrl: "" } }),
}));

const DashboardPage = (await import("../app/DashboardPage")).default;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** yyyy-mm-dd, `n` days from today (local). */
function day(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const trip = (id: string, destination: string | null, start: number | null, len = 4, extra = {}) => ({
  session_id: id,
  title: `${destination ?? "Chat"} trip`,
  pinned: false,
  last_message_at: null,
  planned_at: null,
  origin: "Kolkata",
  destination,
  start_date: start === null ? null : day(start),
  end_date: start === null ? null : day(start + len),
  travelers: 1,
  profile: "Best Value",
  total_cost: 18078.4,
  hotel: "Swagatam RTDC Hotel",
  ...extra,
});

function serve(body: JsonBodyType, status = 200) {
  server.use(http.get("http://test-api.local/chat/dashboard", () => HttpResponse.json(body, { status })));
}

const FREE = {
  quota: { limit: 7, used: 4, remaining: 3, resets_at: "2026-10-01T00:00:00+00:00" },
  plan: { tier: "free", name: "Free", expires_at: null },
};

function ChatProbe() {
  const loc = useLocation();
  return <pre data-testid="chat-state">{JSON.stringify(loc.state)}</pre>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  it("greets the user and shows the real quota", async () => {
    serve({ ...FREE, trips: [] });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Welcome back, Aarav" })).toBeInTheDocument();
    expect(screen.getByText(/4 of 7 trip plans used this month/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
  });

  it("counts down to the soonest trip that hasn't ended, ignoring past and undated ones", async () => {
    serve({
      ...FREE,
      trips: [
        trip("later", "Dubai", 40),
        trip("past", "Goa", -30),
        trip("soon", "jaipur", 12),
        trip("nodates", null, null),
      ],
    });
    renderPage();

    expect(await screen.findByText("12 days to Jaipur")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /open plan/i }));
    expect(screen.getByTestId("chat-state")).toHaveTextContent('{"openSessionId":"soon"}');
  });

  it("lists saved trips with real status, package and cost, and opens the right chat", async () => {
    serve({ ...FREE, trips: [trip("soon", "Jaipur", 12), trip("past", "Goa", -30, 3)] });
    renderPage();

    const list = await screen.findByRole("list");
    const rows = within(list).getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Jaipur, 4 days");
    expect(rows[0]).toHaveTextContent(/Upcoming/);
    expect(rows[0]).toHaveTextContent("Best Value · ₹18,078");
    expect(rows[1]).toHaveTextContent("Goa, 3 days");
    expect(rows[1]).toHaveTextContent(/Past/);

    await userEvent.click(rows[1]);
    expect(screen.getByTestId("chat-state")).toHaveTextContent('{"openSessionId":"past"}');
  });

  it("stats come straight from the data -- trips, distinct destinations, upcoming", async () => {
    serve({
      ...FREE,
      trips: [trip("a", "Jaipur", 5), trip("b", "jaipur", 50), trip("c", "Goa", -10)],
    });
    renderPage();

    const stats = (await screen.findByRole("heading", { name: "Your stats" })).parentElement!;
    const value = (label: string) => within(stats).getByText(label).nextElementSibling!.textContent;
    expect(value("Trips planned")).toBe("3");
    expect(value("Destinations")).toBe("2"); // Jaipur counted once
    expect(value("Upcoming trips")).toBe("2");
    expect(value("Plans left this month")).toBe("3 of 7");
    expect(within(stats).getByText("Quota resets")).toBeInTheDocument();
  });

  it("free plan shows Upgrade; premium shows its real expiry and no Upgrade", async () => {
    serve({ ...FREE, trips: [] });
    const { unmount } = renderPage();
    expect(await screen.findByRole("link", { name: /upgrade to premium/i })).toHaveAttribute("href", "/pricing");
    unmount();

    serve({
      quota: { limit: 100, used: 10, remaining: 90, resets_at: "2026-10-01T00:00:00+00:00" },
      plan: { tier: "premium", name: "Premium Monthly", expires_at: "2026-10-15T00:00:00+00:00" },
      trips: [],
    });
    renderPage();
    expect(await screen.findByText("Premium Monthly")).toBeInTheDocument();
    expect(screen.getByText("Premium until")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /upgrade/i })).not.toBeInTheDocument();
  });

  it("with no trips, invites planning one and opens a blank chat", async () => {
    serve({ ...FREE, trips: [] });
    renderPage();

    expect(await screen.findByText("No upcoming trips yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /plan your first trip/i }));
    expect(screen.getByTestId("chat-state")).toHaveTextContent('{"newChat":true}');
  });

  it("shows a real error with a working retry", async () => {
    serve({ detail: "boom" }, 500);
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load your dashboard/i);

    serve({ ...FREE, trips: [] });
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  });
});