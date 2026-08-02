import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

vi.stubEnv("VITE_API_BASE", "http://test-api.local");

const { getQuotaStatus, sendMessage, createSession, claimSessions } = await import("../chatApi");

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("chatApi error handling", () => {
  it("parses a structured {detail: {message, ...}} error body (quota_guard's 429 shape)", async () => {
    server.use(
      http.get("http://test-api.local/chat/quota", () =>
        HttpResponse.json(
          {
            detail: {
              message: "Monthly limit reached (7 trips this month).",
              limit: 7,
              remaining: 0,
              resets_at: "2026-09-01T00:00:00+00:00",
            },
          },
          { status: 429 },
        ),
      ),
    );

    await expect(getQuotaStatus("fake-token")).rejects.toThrow(
      "Monthly limit reached (7 trips this month).",
    );
  });

  it("attaches status and detail onto the thrown error for callers that need them", async () => {
    server.use(
      http.get("http://test-api.local/chat/quota", () =>
        HttpResponse.json(
          { detail: { message: "Blocked.", limit: 7, remaining: 0 } },
          { status: 429 },
        ),
      ),
    );

    try {
      await getQuotaStatus("fake-token");
      expect.fail("should have thrown");
    } catch (err) {
      const error = err as Error & { status?: number; detail?: unknown };
      expect(error.status).toBe(429);
      expect((error.detail as { limit: number }).limit).toBe(7);
    }
  });

  it("still handles a plain string detail (e.g. a 401 from get_current_user)", async () => {
    server.use(
      http.post("http://test-api.local/chat/sessions/s1/messages", () =>
        HttpResponse.json({ detail: "Unauthorized" }, { status: 401 }),
      ),
    );

    await expect(
      sendMessage("s1", "device-1", "bad-token", "Plan a trip"),
    ).rejects.toThrow("Unauthorized");
  });

  it("falls back to raw text when the error body isn't JSON at all", async () => {
    server.use(
      http.get("http://test-api.local/chat/quota", () =>
        HttpResponse.text("Internal Server Error", { status: 500 }),
      ),
    );

    await expect(getQuotaStatus("fake-token")).rejects.toThrow(
      "Internal Server Error",
    );
  });

  it("omits the Authorization header entirely for a null token (guest requests)", async () => {
    let capturedAuthHeader: string | null = null;
    server.use(
      http.post("http://test-api.local/chat/sessions/s1/messages", ({ request }) => {
        capturedAuthHeader = request.headers.get("authorization");
        return HttpResponse.json({ id: "msg1", role: "assistant", content: "ok" });
      }),
    );

    await sendMessage("s1", "device-1", null, "Plan a trip");

    expect(capturedAuthHeader).toBeNull();
  });

  it("createSession sends the device_id and title in the request body", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("http://test-api.local/chat/sessions", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "s1", title: "Trip", status: "active", pinned: false, last_message_at: "", created_at: "" });
      }),
    );

    const result = await createSession("device-1", "fake-token", "Trip");

    expect(result.id).toBe("s1");
    expect(capturedBody).toEqual({ device_id: "device-1", title: "Trip" });
  });

  it("claimSessions posts to the claim endpoint with the device_id and returns the claimed count", async () => {
    server.use(
      http.post("http://test-api.local/chat/sessions/claim", async ({ request }) => {
        const body = await request.json();
        expect(body).toEqual({ device_id: "device-1" });
        return HttpResponse.json({ claimed: 2 });
      }),
    );

    const result = await claimSessions("device-1", "fake-token");

    expect(result.claimed).toBe(2);
  });
});
