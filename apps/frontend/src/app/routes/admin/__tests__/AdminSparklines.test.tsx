import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

import { healthStatus, periodDelta } from "../components/adminMetrics";
import { StatusPill, TrendTile } from "../components/AdminUI";

vi.stubEnv("VITE_API_BASE", "http://test-api.local");
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: async () => "tok" }),
  useUser: () => ({ user: { publicMetadata: { role: "admin" } } }),
  UserButton: () => null,
}));

const DATES = Array.from({ length: 14 }, (_, i) => `2026-09-${String(10 + i).padStart(2, "0")}`);

describe("adminMetrics", () => {
  it("healthStatus: down, slow over 1s, healthy otherwise", () => {
    expect(healthStatus({ ok: false })).toBe("down");
    expect(healthStatus({ ok: true, latency_ms: 4718 })).toBe("slow");
    expect(healthStatus({ ok: true, latency_ms: 2.36 })).toBe("ok");
  });

  it("periodDelta compares the last 7 days with the 7 before", () => {
    const prev = [1, 1, 1, 1, 1, 1, 4]; // 10
    const cur = [2, 2, 2, 2, 2, 2, 3]; // 15
    expect(periodDelta([...prev, ...cur])).toEqual({ current: 15, previous: 10, pct: 50 });
    expect(periodDelta([...Array(7).fill(0), ...cur])!.pct).toBeNull(); // no baseline
    expect(periodDelta([1, 2, 3])).toBeNull(); // not a full 14 days
  });
});

describe("StatusPill", () => {
  it("labels Slow with text + icon, never colour alone", () => {
    render(<StatusPill status="slow" />);
    const pill = screen.getByText("Slow");
    expect(pill.querySelector("svg")).not.toBeNull();
  });
});

describe("TrendTile + Sparkline", () => {
  const values = [0, 1, 1, 1, 1, 1, 5, 2, 2, 2, 2, 2, 2, 3]; // prev 10, current 15
  const series = { dates: DATES, values, unit: "new session", label: "New sessions per day" };

  it("shows value, a signed delta vs a named period, and one bar per day", () => {
    const { container } = render(<TrendTile label="Sessions" value={1284} series={series} />);
    expect(screen.getByText("1,284")).toBeInTheDocument();
    expect(screen.getByText("▲ +50%")).toBeInTheDocument();
    expect(screen.getByText("vs previous 7 days")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: /new sessions per day, last 14 days/i });
    expect(group.children).toHaveLength(14);
    expect(container.querySelector("table caption")).toHaveTextContent("New sessions per day (UTC days)");
  });

  it("down is red ▼, and a week with no baseline says so instead of a fake %", () => {
    const { rerender } = render(
      <TrendTile label="Trips" value={9} series={{ ...series, values: [...Array(7).fill(2), ...Array(7).fill(1)] }} />,
    );
    expect(screen.getByText("▼ -50%")).toHaveClass("text-accent-red");

    rerender(<TrendTile label="Trips" value={9} series={{ ...series, values: [...Array(7).fill(0), ...Array(7).fill(1)] }} />);
    expect(screen.getByText(/7 this week · none the week before/)).toBeInTheDocument();
  });

  it("hover a day to read it; keyboard arrows walk the days", async () => {
    render(<TrendTile label="Sessions" value={1} series={series} />);
    const group = screen.getByRole("group");

    fireEvent.pointerEnter(group.children[6]);
    expect(screen.getByRole("status")).toHaveTextContent("5 new sessions");

    fireEvent.pointerLeave(group);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => group.focus()); // starts on today
    expect(screen.getByRole("status")).toHaveTextContent("3 new sessions");
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("status")).toHaveTextContent("2 new sessions");
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("status")).toHaveTextContent("0 new sessions");
  });

  it("a table view carries every value", () => {
    const { container } = render(<TrendTile label="Sessions" value={1} series={series} />);
    const rows = within(container.querySelector("table")!).getAllByRole("row");
    expect(rows).toHaveLength(15); // header + 14 days
  });
});

/* ---------------- page wiring ---------------- */

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const DASHBOARD = {
  analytics: {
    window_days: 7, total_sessions: 94, new_sessions_in_window: 12, total_messages: 219, trips_generated: 31,
    user_messages_by_day: {}, conversation_type_distribution: { NEW_TRIP: 3 },
  },
  monitoring: {
    checks: { redis: { ok: true, latency_ms: 2.36 }, supabase: { ok: true, latency_ms: 4718 } },
    cache: { hits: 0, misses: 0 }, chat: { success: 0, errors: 0 }, rag: { calls: 0, errors: 0 }, generated_at: "",
  },
  open_contact_submissions: 0,
};

async function renderDashboard() {
  const { default: AdminDashboardPage } = await import("../AdminDashboardPage");
  return render(
    <MemoryRouter>
      <AdminDashboardPage />
    </MemoryRouter>,
  );
}

describe("AdminDashboardPage", () => {
  it("renders sparklines from /admin/timeseries and flags slow Supabase", async () => {
    server.use(
      http.get("http://test-api.local/admin/dashboard", () => HttpResponse.json(DASHBOARD)),
      http.get("http://test-api.local/admin/timeseries", ({ request }) => {
        expect(new URL(request.url).searchParams.get("days")).toBe("14");
        return HttpResponse.json({
          days: 14, timezone: "UTC", dates: DATES, truncated: false,
          series: { sessions: Array(14).fill(1), messages: Array(14).fill(3), trips: Array(14).fill(0) },
        });
      }),
    );
    await renderDashboard();

    expect(await screen.findByRole("group", { name: /new sessions per day/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /user messages per day/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /trips generated per day/i })).toBeInTheDocument();
    expect(screen.getByText("Slow")).toBeInTheDocument(); // supabase 4718ms
    expect(screen.getByText("Healthy")).toBeInTheDocument(); // redis 2ms
  });

  it("if the time series fails, every total still shows and says why the charts are missing", async () => {
    server.use(
      http.get("http://test-api.local/admin/dashboard", () => HttpResponse.json(DASHBOARD)),
      http.get("http://test-api.local/admin/timeseries", () => HttpResponse.json({ detail: "x" }, { status: 500 })),
    );
    await renderDashboard();

    expect(await screen.findByText("94")).toBeInTheDocument();
    expect(screen.getByText("219")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByText(/daily trends couldn't load/i)).toBeInTheDocument();
  });
});