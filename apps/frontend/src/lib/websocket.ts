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

// Delivered by the async message worker once a NEW_TRIP/MODIFY_TRIP
// turn actually finishes -- the HTTP response for these no longer
// carries the result directly (see chatApi.ts::sendMessage), since
// waiting on it synchronously was what caused real requests to be
// cut off by API Gateway's ~29s timeout on the slower end of real
// trip-planning latency (confirmed live: 20-80+ seconds for real
// requests, worse for international destinations).
export interface ResultEvent {
  type: "result";
  message: { id: string; role: string; content: string; trip_data?: unknown };
}

export interface ErrorEvent {
  type: "error";
  message: { id: string; role: string; content: string };
}

export type SocketEvent = ProgressEvent | TokenEvent | ResultEvent | ErrorEvent;

const WS_URL=import.meta.env.VITE_WS_URL;

export function connectProgressSocket(
  sessionId: string,
  onEvent: (event: SocketEvent) => void,
): WebSocket {
  const socket = new WebSocket(
    `${WS_URL}?client_id=${sessionId}`,
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
    const cleanup = () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
      clearTimeout(timer);
    };

    const onOpen = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      resolve(); // don't block chat just because live progress updates aren't available
    };

    socket.addEventListener("open", onOpen, { once: true });
    socket.addEventListener("error", onError, { once: true });

    // Safety net: never wait more than 3s regardless of what the socket does
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, 3000);
  });
}