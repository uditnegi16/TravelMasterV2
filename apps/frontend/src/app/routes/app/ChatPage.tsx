import { useCallback, useEffect, useRef, useState } from "react";
import { getDeviceId } from "../../../lib/deviceId";
import {
  connectProgressSocket,
  waitForSocketOpen,
  type SocketEvent,
} from "../../../lib/websocket";
import {
  createSession,
  deleteSession,
  listMessages,
  listSessions,
  renameSession,
  sendMessage,
  setSessionPinned,
  type ChatMessage,
  type ChatSessionSummary,
} from "../../services/chatApi";

import ChatSidebar from "../../components/chat/ChatSidebar";
import ChatThread from "../../components/planner/ChatThread";
import { AiPromptBox } from "../../components/input/AiPromptBox";
import AiThinkingLoader from "../../components/loading/AiThinkingLoader";
import { useAuth } from "@clerk/clerk-react";
export default function ChatPage() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [currentStage, setCurrentStage] = useState("");
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const { getToken } = useAuth();
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, streamingText, currentStage]);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  const refreshSessions = useCallback(
    async (id: string) => {
      const token = await getToken();

      if (!token) {
        throw new Error("Not authenticated");
      }

      const list = await listSessions(id, token);
      setSessions(list);
      return list;
    },
    [getToken],
  );

  useEffect(() => {
    if (!deviceId) return;

    void (async () => {
      const list = await refreshSessions(deviceId);
      if (list.length > 0) {
        void openSession(list[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, refreshSessions]);

  async function openSession(sessionId: string) {
    if (!deviceId) return;

    const token = await getToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    setActiveSessionId(sessionId);
    setMessages(await listMessages(sessionId, deviceId, token));
  }

  async function handleNewChat() {
    if (!deviceId) return;

    const token = await getToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    const session = await createSession(deviceId, token);

    await refreshSessions(deviceId);

    setActiveSessionId(session.id);
    setMessages([]);
  }

  async function handleRename(sessionId: string, title: string) {
    if (!deviceId) return;

    const token = await getToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    await renameSession(sessionId, deviceId, token, title);

    await refreshSessions(deviceId);
  }

async function handleTogglePin(sessionId: string, pinned: boolean) {
  if (!deviceId) return;

  const token = await getToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  await setSessionPinned(sessionId, deviceId, token, pinned);

  await refreshSessions(deviceId);
}

  async function handleDelete(sessionId: string) {
    if (!deviceId) return;
   const token = await getToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    await deleteSession(sessionId, deviceId, token);
    const list = await refreshSessions(deviceId);

    if (activeSessionId === sessionId) {
      if (list.length > 0) {
        void openSession(list[0].id);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    }
  }

  async function handleSubmit(query: string) {
    if (!deviceId) return;

    const token = await getToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    let sessionId = activeSessionId;

    if (!sessionId) {
      const session = await createSession(deviceId, token, query);

      sessionId = session.id;
      setActiveSessionId(sessionId);

      await refreshSessions(deviceId);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        role: "user",
        content: query,
        trip_data: null,
        created_at: new Date().toISOString(),
      },
    ]);

    setLoading(true);
    setStreamingText("");
    setCurrentStage("TravelMaster is thinking...");

    const socket = connectProgressSocket(sessionId, (event: SocketEvent) => {
      if (event.type === "progress") {
        setCurrentStage(
          event.message ?? "TravelMaster is working..."
        );
      } else if (event.type === "token") {
        setStreamingText((prev) => prev + event.token);
      }
    });

    try {
      await waitForSocketOpen(socket);
      const response = await sendMessage(
        sessionId,
        deviceId,
        token,
        query,
      );

      setMessages(await listMessages(sessionId, deviceId, token));
      await refreshSessions(deviceId);
      void response;
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            err instanceof Error
              ? `Sorry — ${err.message}`
              : "Sorry, something went wrong planning that trip.",
          trip_data: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setStreamingText("");
      socket.close();
    }
  }

  return (
    <div className="flex h-[calc(100dvh-72px)] overflow-hidden bg-surface-subtle">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={openSession}
        onNewChat={handleNewChat}
        onRename={handleRename}
        onTogglePin={handleTogglePin}
        onDelete={handleDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex w-full flex-1 justify-center overflow-y-auto px-6 py-8">
          <div className="w-full max-w-5xl">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <h2 className="font-display text-2xl font-semibold text-ink">
                  TravelMaster AI
              </h2>

              <p className="mt-2 max-w-xl text-ink-muted">
                  Plan complete trips, modify existing itineraries, compare options,
                  ask destination questions, get travel advice, or continue any previous
                  conversation. Your trip planning and chat stay together in one place.
              </p>
            </div>
          ) : (
            <ChatThread messages={messages} streamingText={streamingText} />
          )}

          {loading && (
            <div className="mt-5">
              <AiThinkingLoader visible={loading} message={currentStage} />
            </div>
          )}
          <div ref={scrollAnchorRef} />
          </div>
        </div>

        <div className="border-t border-border bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto w-full max-w-4xl">
            <AiPromptBox
              size="compact"
              onSubmit={handleSubmit}
              disabled={loading}
              placeholder="Plan a trip or ask anything about travel..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}