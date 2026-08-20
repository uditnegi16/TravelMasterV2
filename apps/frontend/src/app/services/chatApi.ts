import { API_URL } from "./api";
import type { Trip } from "../models/trip";

export interface ChatSessionSummary {
  id: string;
  title: string;
  status: "active" | "archived" | "deleted";
  pinned: boolean;
  last_message_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  trip_data: Trip | null;
  created_at: string;
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let message = raw || `Request failed with ${response.status}`;
    let detail: unknown = undefined;
    try {
      const parsed = JSON.parse(raw);
      detail = parsed?.detail;
      if (typeof detail === "string") {
        message = detail;
      } else if (detail && typeof detail === "object" && typeof (detail as { message?: unknown }).message === "string") {
        // Structured error bodies, e.g. quota_guard's 429:
        // {message, limit, remaining, resets_at} -- show the message,
        // keep the rest attached to the error for callers that want it.
        message = (detail as { message: string }).message;
      }
    } catch {
      // raw wasn't JSON -- fall back to the raw text as-is.
    }
    const error = new Error(message) as Error & { status?: number; detail?: unknown };
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response.json();
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function claimSessions(
  deviceId: string,
  token: string,
): Promise<{ claimed: number }> {
  const res = await fetch(`${API_URL}/chat/sessions/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ device_id: deviceId }),
  });

  return handle<{ claimed: number }>(res);
}

export async function listSessions(
  deviceId: string,
  token: string,
): Promise<ChatSessionSummary[]> {
  const res = await fetch(
    `${API_URL}/chat/sessions?device_id=${encodeURIComponent(deviceId)}`,
    {
      headers: authHeaders(token),
    },
  );

  const data = await handle<{ sessions: ChatSessionSummary[] }>(res);
  return data.sessions;
}

export async function createSession(
  deviceId: string,
  token: string | null,
  title?: string,
): Promise<ChatSessionSummary> {
  const res = await fetch(`${API_URL}/chat/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({
      device_id: deviceId,
      title,
    }),
  });

  return handle<ChatSessionSummary>(res);
}

export async function renameSession(
  sessionId: string,
  deviceId: string,
  token: string,
  title: string,
): Promise<ChatSessionSummary> {
  const res = await fetch(`${API_URL}/chat/sessions/${sessionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({
      device_id: deviceId,
      title,
    }),
  });

  return handle<ChatSessionSummary>(res);
}

export async function setSessionPinned(
  sessionId: string,
  deviceId: string,
  token: string,
  pinned: boolean,
): Promise<ChatSessionSummary> {
  const res = await fetch(`${API_URL}/chat/sessions/${sessionId}/pin`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({
      device_id: deviceId,
      pinned,
    }),
  });

  return handle<ChatSessionSummary>(res);
}

export async function deleteSession(
  sessionId: string,
  deviceId: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/chat/sessions/${sessionId}?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    },
  );

  await handle<{ ok: boolean }>(res);
}

export async function listMessages(
  sessionId: string,
  deviceId: string,
  token: string | null,
): Promise<ChatMessage[]> {
  const res = await fetch(
    `${API_URL}/chat/sessions/${sessionId}/messages?device_id=${encodeURIComponent(deviceId)}`,
    {
      headers: authHeaders(token),
    },
  );

  const data = await handle<{ messages: ChatMessage[] }>(res);
  return data.messages;
}

// Two genuinely different shapes. FOLLOW_UP/INFO_REQUEST/GENERAL_CHAT
// are unchanged -- a single quick call, answered synchronously, same
// shape as always. NEW_TRIP/MODIFY_TRIP now return immediately once
// queued (status: "processing") rather than waiting on the full
// multi-agent pipeline, which was getting some real requests cut off
// by API Gateway's ~29s timeout. The actual result for those arrives
// over the WebSocket instead (see websocket.ts's ResultEvent/ErrorEvent).
export interface SendMessageResponseSync {
  session: ChatSessionSummary;
  message: ChatMessage;
  trip?: Trip;
  error?: boolean;
  message_text?: string;
}

export interface SendMessageResponseQueued {
  session: ChatSessionSummary;
  status: "processing";
  conversation_type: string;
}

export type SendMessageResponse = SendMessageResponseSync | SendMessageResponseQueued;

export function isQueuedResponse(
  response: SendMessageResponse,
): response is SendMessageResponseQueued {
  return "status" in response && response.status === "processing";
}

export type QuotaStatus = {
  limit: number;
  used: number;
  remaining: number;
  resets_at: string;
};

export async function getQuotaStatus(token: string): Promise<QuotaStatus> {
  const res = await fetch(`${API_URL}/chat/quota`, {
    headers: authHeaders(token),
  });
  return handle<QuotaStatus>(res);
}
export async function sendMessage(
  sessionId: string,
  deviceId: string,
  token: string | null,
  query: string,
): Promise<SendMessageResponse> {
  const res = await fetch(`${API_URL}/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({
      device_id: deviceId,
      query,
    }),
  });

  return handle<SendMessageResponse>(res);
}