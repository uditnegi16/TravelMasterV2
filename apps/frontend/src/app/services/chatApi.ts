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
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return response.json();
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
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
  token: string,
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
  token: string,
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

export interface SendMessageResponse {
  session: ChatSessionSummary;
  message: ChatMessage;
  trip?: Trip;
  error?: boolean;
  message_text?: string;
}

export async function sendMessage(
  sessionId: string,
  deviceId: string,
  token: string,
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