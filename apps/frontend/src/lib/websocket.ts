export interface ProgressEvent {
  type: "progress";
  stage: string;
  status: "started" | "completed" | "failed";
  message?: string;
}

export interface TokenEvent {
  type: "token";
  token: string;
}

export type SocketEvent = ProgressEvent | TokenEvent;

export function connectProgressSocket(
  sessionId: string,
  onEvent: (event: SocketEvent) => void,
): WebSocket {
  const socket = new WebSocket(
    `ws://127.0.0.1:8000/ws/progress/${sessionId}`,
  );

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as SocketEvent;
      onEvent(data);
    } catch {
      // Ignore malformed payloads rather than crashing the UI.
    }
  };

  return socket;
}

// Phase 5 fix: PlanTripPage previously opened the socket and fired the
// POST /plan-trip request back-to-back without waiting for the socket
// handshake to complete. If the backend responded fast enough, the very
// first progress event (e.g. "planner started") could arrive before the
// server had registered the connection, and it would be silently
// dropped (ConnectionManager.send() no-ops for an unknown client_id).
// Callers should await this before firing the plan-trip request.
export function waitForSocketOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    socket.addEventListener("open", () => resolve(), { once: true });
  });
}