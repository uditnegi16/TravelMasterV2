import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDeviceId } from "../../../lib/deviceId";
import {
  connectProgressSocket,
  waitForSocketOpen,
  type SocketEvent,
} from "../../../lib/websocket";
import {
  claimSessions,
  createSession,
  deleteSession,
  getQuotaStatus,
  isQueuedResponse,
  listMessages,
  listSessions,
  renameSession,
  sendMessage,
  setSessionPinned,
  type ChatMessage,
  type ChatSessionSummary,
  type QuotaStatus,
} from "../../services/chatApi";

import ChatSidebar from "../../components/chat/ChatSidebar";
import ChatThread from "../../components/planner/ChatThread";
import { AiPromptBox } from "../../components/input/AiPromptBox";
import AiThinkingLoader from "../../components/loading/AiThinkingLoader";
import { useAuth, SignInButton } from "@clerk/clerk-react";

export default function ChatPage() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [currentStage, setCurrentStage] = useState("");
  const [guestTrialUsed, setGuestTrialUsed] = useState(false);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const latestRequestedSessionId = useRef<string | null>(null);
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Issue 1: a prompt carried from the landing page's hero box (guest
  // or signed-in, either way) -- consumed once on mount, then cleared
  // from history state so a refresh doesn't resubmit it.
  const carriedPrompt =
    (location.state as { prompt?: string } | null)?.prompt ?? null;

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, streamingText, currentStage]);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  const refreshSessions = useCallback(
    async (id: string) => {
      const token = await getToken();
      if (!token) return []; // signed out -- guests get no sidebar history

      const list = await listSessions(id, token);
      setSessions(list);
      return list;
    },
    [getToken],
  );

  const refreshQuota = useCallback(async () => {
    const token = await getToken();
    if (!token) return; // no account-based quota for guests (Issue 1)
    try {
      setQuota(await getQuotaStatus(token));
    } catch {
      // Non-critical -- the quota display is informational, a failed
      // fetch here shouldn't disrupt anything else on the page.
    }
  }, [getToken]);

  // Signed-in flow: load session history and open the most recent one,
  // same as before. Guests skip this entirely -- no history to load
  // until they sign in (see claim-on-login, Issue 2).
  useEffect(() => {
    if (!deviceId || !isLoaded) return;
    if (!isSignedIn) return;

    void (async () => {
      try {
        const list = await refreshSessions(deviceId);
        if (list.length > 0 && !carriedPrompt) {
          void openSession(list[0].id);
        }
      } catch {
        setLoadError("Couldn't load your conversations. Please refresh the page.");
      }
    })();
    void refreshQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, isLoaded, isSignedIn, refreshSessions]);

  // A prompt carried from the landing page -- submit it once, whether
  // the visitor is a guest (Issue 1: one free trip, no account) or
  // already signed in. Clears the carried state afterward so a page
  // refresh doesn't resubmit it.
  useEffect(() => {
    if (!deviceId || !isLoaded || !carriedPrompt) return;

    void handleSubmit(carriedPrompt);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, isLoaded, carriedPrompt]);

  // A guest just signed in -- claim whatever session(s) this device
  // had (Issue 2's explicit-migration design: only ever fires right
  // after a real sign-in action, never silently on page load, and
  // only touches rows this device_id created that no account owns
  // yet). Without this, a guest's just-planned trial trip would
  // vanish the moment they create an account.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (!deviceId || !isLoaded) return;

    if (isSignedIn && !wasSignedIn.current) {
      void (async () => {
        const token = await getToken();
        if (!token) return;
        await claimSessions(deviceId, token);
        setGuestTrialUsed(false);
        await refreshSessions(deviceId);
      })();
    }
    wasSignedIn.current = !!isSignedIn;
  }, [deviceId, isLoaded, isSignedIn, getToken, refreshSessions]);

  const openSocketsRef = useRef<Set<WebSocket>>(new Set());

  useEffect(() => {
    // Frontend-side cleanup only -- closing the socket stops this
    // browser tab from listening for further progress/token events,
    // but does NOT stop the backend's agent graph invocation itself
    // (that would need the Lambda to check a cancellation signal
    // mid-execution, real backend work beyond this pass). This at
    // least prevents a lingering open connection and stray setState
    // calls after the user has actually left the page.
    const sockets = openSocketsRef.current;
    return () => {
      sockets.forEach((s) => s.close());
      sockets.clear();
    };
  }, []);

  async function openSession(sessionId: string) {
    if (!deviceId) return;

    latestRequestedSessionId.current = sessionId;
    setActiveSessionId(sessionId);
    setLoadError(null);

    const token = await getToken();
    try {
      const fetched = await listMessages(sessionId, deviceId, token);
      // A newer openSession() call may have started (and possibly
      // already resolved) while this one was in flight -- only apply
      // this result if it's still the one the user is actually
      // looking at. Without this check, whichever request happened to
      // resolve LAST would win regardless of which session is
      // currently selected.
      if (latestRequestedSessionId.current === sessionId) {
        setMessages(fetched);
      }
    } catch {
      if (latestRequestedSessionId.current === sessionId) {
        setLoadError("Couldn't load that conversation. Please try again.");
      }
    }
  }

  async function handleNewChat() {
    if (!deviceId || !isSignedIn) return; // account feature only

    const token = await getToken();
    if (!token) return;

    const session = await createSession(deviceId, token);
    await refreshSessions(deviceId);
    setActiveSessionId(session.id);
    setMessages([]);
  }

  async function handleRename(sessionId: string, title: string) {
    if (!deviceId || !isSignedIn) return;

    const token = await getToken();
    if (!token) return;

    await renameSession(sessionId, deviceId, token, title);
    await refreshSessions(deviceId);
  }

  async function handleTogglePin(sessionId: string, pinned: boolean) {
    if (!deviceId || !isSignedIn) return;

    const token = await getToken();
    if (!token) return;

    await setSessionPinned(sessionId, deviceId, token, pinned);
    await refreshSessions(deviceId);
  }

  async function handleDelete(sessionId: string) {
    if (!deviceId || !isSignedIn) return;

    const token = await getToken();
    if (!token) return;

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
    setQuotaExceeded(false);
    setLastFailedQuery(null);

    // Signed-in visitors always send a real token; guests send null
    // and the backend treats the request as anonymous (Issue 1).
    const token = isSignedIn ? await getToken() : null;

    let sessionId = activeSessionId;

    if (!sessionId) {
      try {
        const session = await createSession(deviceId, token, query);
        sessionId = session.id;
        setActiveSessionId(sessionId);
        latestRequestedSessionId.current = sessionId;
        if (token) await refreshSessions(deviceId);
      } catch (err) {
        const status = (err as { status?: number } | undefined)?.status;
        if (status === 403) {
          // Guest trial already used on this device -- ask them to
          // sign in rather than showing a generic error bubble.
          setGuestTrialUsed(true);
          return;
        }
        throw err;
      }
    }

    latestRequestedSessionId.current = sessionId;
    const submissionSessionId = sessionId;

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

    // Resolves when the async worker's real result (or a failure)
    // arrives over the socket -- only meaningful for a queued
    // (NEW_TRIP/MODIFY_TRIP) response; the old synchronous response
    // shape (FOLLOW_UP/INFO_REQUEST/GENERAL_CHAT) never needs this.
    let resolveOutcome: (() => void) | null = null;
    const outcomeArrived = new Promise<void>((resolve) => {
      resolveOutcome = resolve;
    });

    const socket = connectProgressSocket(sessionId, (event: SocketEvent) => {
      if (event.type === "progress") {
        setCurrentStage(event.message ?? "TravelMaster is working...");
      } else if (event.type === "token") {
        setStreamingText((prev) => prev + event.token);
      } else if (event.type === "result" || event.type === "error") {
        resolveOutcome?.();
      }
    });
    openSocketsRef.current.add(socket);

    try {
      await waitForSocketOpen(socket);
      const response = await sendMessage(sessionId, deviceId, token, query);

      // Real trip-planning requests genuinely take 20-80+ seconds
      // (confirmed live, worse for international destinations). The
      // `token` captured at the top of this function, before that
      // wait, can genuinely be expired by now -- refetch a fresh one
      // rather than reuse the stale one (a real user hit exactly
      // this: the answer was already generated and saved, but the
      // follow-up fetch failed with a stale token and 404'd).
      const freshToken = isSignedIn ? await getToken() : null;

      if (isQueuedResponse(response)) {
        // The real result arrives over the socket, not this HTTP
        // response -- wait for it, but not forever. A dropped
        // connection shouldn't leave the user staring at a spinner
        // indefinitely; the worker writes to the database regardless
        // of whether the socket delivery itself succeeds, so a
        // fallback re-fetch after the timeout still recovers the
        // real result in that case.
        const timeoutHit = await Promise.race([
          outcomeArrived.then(() => false),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 45_000)),
        ]);

        const fetched = await listMessages(sessionId, deviceId, freshToken);
        const lastMessage = fetched[fetched.length - 1];
        const stillWaiting = !lastMessage || lastMessage.role !== "assistant";

        if (latestRequestedSessionId.current === submissionSessionId) {
          if (stillWaiting && timeoutHit) {
            // Genuinely still processing (or failed without ever
            // writing a reply) after a real, generous wait -- not the
            // same as a normal failure (retrying would spend another
            // quota slot on a request that might still complete), so
            // it gets its own distinct message.
            setMessages((prev) => [
              ...prev,
              {
                id: `pending-notice-${Date.now()}`,
                role: "assistant",
                content:
                  "This is taking longer than expected. Your trip may still be processing — check back in a moment, or refresh the page.",
                trip_data: null,
                created_at: new Date().toISOString(),
              },
            ]);
          } else {
            setMessages(fetched);
          }
          if (freshToken) {
            await refreshSessions(deviceId);
            void refreshQuota();
          }
        }
      } else {
        // Old synchronous shape (FOLLOW_UP/INFO_REQUEST/GENERAL_CHAT)
        // -- unchanged, the full answer is already in this response.
        const fetched = await listMessages(sessionId, deviceId, freshToken);
        if (latestRequestedSessionId.current === submissionSessionId) {
          setMessages(fetched);
          if (freshToken) {
            await refreshSessions(deviceId);
            void refreshQuota();
          }
        }
      }
      void response;
    } catch (err) {
      const status = (err as { status?: number } | undefined)?.status;
      if (status === 429) {
        setQuotaExceeded(true);
        return;
      }
      if (latestRequestedSessionId.current !== submissionSessionId) {
        // User has since switched to a different session -- the
        // failure is real, but it's stale from their current
        // perspective, and injecting an error bubble into whatever
        // conversation they're looking at now would be misleading.
        return;
      }
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
      setLastFailedQuery(query);
    } finally {
      // Always safe to run regardless of which session is now active
      // -- this specific socket/loading-flag only ever belonged to
      // this one submission.
      setLoading(false);
      setStreamingText("");
      socket.close();
      openSocketsRef.current.delete(socket);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-72px)] overflow-hidden bg-surface-subtle">
      {isSignedIn && (
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={openSession}
          onNewChat={handleNewChat}
          onRename={handleRename}
          onTogglePin={handleTogglePin}
          onDelete={handleDelete}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex w-full flex-1 justify-center overflow-y-auto px-6 py-8">
          <div className="w-full max-w-5xl">
          {loadError && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {loadError}
            </div>
          )}

          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <h2 className="font-display text-2xl font-semibold text-ink">
                  TravelMaster AI
              </h2>

              <p className="mt-2 max-w-xl text-ink-muted">
                {isSignedIn
                  ? "Plan complete trips, modify existing itineraries, compare options, ask destination questions, get travel advice, or continue any previous conversation. Your trip planning and chat stay together in one place."
                  : "Describe a trip and TravelMaster will plan it — no account needed for your first trip."}
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
            {quota && !guestTrialUsed && !quotaExceeded && (
              <p className="mb-2 text-center text-xs text-ink-faint">
                {quota.remaining} of {quota.limit} trip plans left this month
              </p>
            )}

            {lastFailedQuery && !guestTrialUsed && !quotaExceeded && (
              <div
                role="alert"
                className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
              >
                <span>That last message didn't go through.</span>
                <button
                  type="button"
                  onClick={() => void handleSubmit(lastFailedQuery)}
                  disabled={loading}
                  className="shrink-0 font-semibold underline disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            )}

            {guestTrialUsed ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-5 text-center">
                <p className="text-sm text-ink-muted">
                  You've used your free trip. Sign in to keep planning —
                  your account gets more trips per month and saves your
                  history.
                </p>
                <SignInButton mode="modal">
                  <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
                    Sign in
                  </button>
                </SignInButton>
              </div>
            ) : quotaExceeded ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-5 text-center">
                <p className="text-sm text-ink-muted">
                  {quota
                    ? `You've used all ${quota.limit} trip plans for this month.`
                    : "You've reached this month's trip-planning limit."}{" "}
                  Upgrade for more, or wait until next month.
                </p>
                <a
                  href="/pricing"
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                >
                  See plans
                </a>
              </div>
            ) : (
              <AiPromptBox
                size="compact"
                onSubmit={handleSubmit}
                disabled={loading}
                placeholder="Plan a trip or ask anything about travel..."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
