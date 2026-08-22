import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { Plus, Pin, PinOff, Pencil, Trash2, PanelLeftClose, PanelLeft } from "lucide-react";

import { cn } from "../../../lib/cn";
import type { ChatSessionSummary } from "../../services/chatApi";

type ChatSidebarProps = {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onRename: (sessionId: string, title: string) => void;
  onTogglePin: (sessionId: string, pinned: boolean) => void;
  onDelete: (sessionId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ChatSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onRename,
  onTogglePin,
  onDelete,
  open,
  onOpenChange,
}: ChatSidebarProps) {
  // Open/closed is owned by ChatPage so the chat pane's menu button can
  // drive it. On mobile this is a real overlay drawer; on desktop it is
  // a side-by-side column that can still be collapsed to a rail.
  const collapsed = !open;
  const setCollapsed = (value: boolean) => onOpenChange(!value);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function startRename(session: ChatSessionSummary) {
    setEditingId(session.id);
    setEditValue(session.title);
  }

  function commitRename(sessionId: string) {
    const title = editValue.trim();
    if (title) onRename(sessionId, title);
    setEditingId(null);
  }

  if (collapsed) {
    return (
      <div className="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-border bg-white py-4">
        <button
          aria-label="Expand sidebar"
          onClick={() => setCollapsed(false)}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-subtle hover:text-ink"
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
        <button
          aria-label="New chat"
          onClick={onNewChat}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white hover:bg-black"
        >
          <Plus className="h-[18px] w-[18px]" />
        </button>
      </div>
    );
  }

  const pinned = sessions.filter((s) => s.pinned);
  const rest = sessions.filter((s) => !s.pinned);

  return (
    <>
      {/* Mobile-only backdrop -- tapping it closes the drawer. Real bug
          report (2026-08-19): on mobile, "opening" the sidebar left a
          visible sliver of the chat pane on the right, because this
          component had zero mobile-specific handling at all -- it was
          a permanent desktop flex-row sibling (w-72), never a full
          overlay. On a narrow viewport, the chat pane's flex-1 sibling
          never fully disappears, it just shrinks to whatever width is
          left over -- exactly the reported "slit." Fixed with a real
          fixed-position overlay + backdrop on mobile only
          (`md:hidden`/`md:static` pairs below); desktop's existing
          side-by-side layout is untouched. */}
      <div
        onClick={() => setCollapsed(true)}
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-border bg-white md:relative md:z-auto">
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <button
            onClick={onNewChat}
            className="flex flex-1 items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
          <button
            aria-label="Collapse sidebar"
            onClick={() => setCollapsed(true)}
            className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-subtle hover:text-ink"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 && (
            <p className="p-4 text-center text-sm text-ink-faint">
              No conversations yet. Start planning a trip to see it here.
            </p>
          )}

          {pinned.length > 0 && (
            <SessionGroup
              label="Pinned"
              sessions={pinned}
              activeSessionId={activeSessionId}
              editingId={editingId}
              editValue={editValue}
              onEditValueChange={setEditValue}
              onSelect={onSelect}
              onStartRename={startRename}
              onCommitRename={commitRename}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
            />
          )}

          <SessionGroup
            label={pinned.length > 0 ? "All chats" : undefined}
            sessions={rest}
            activeSessionId={activeSessionId}
            editingId={editingId}
            editValue={editValue}
            onEditValueChange={setEditValue}
            onSelect={onSelect}
            onStartRename={startRename}
            onCommitRename={commitRename}
            onTogglePin={onTogglePin}
            onDelete={onDelete}
          />
        </div>

        <SidebarFooter onNavigate={() => setCollapsed(true)} />
      </div>
    </>
  );
}

type SessionGroupProps = {
  label?: string;
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  editingId: string | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onSelect: (sessionId: string) => void;
  onStartRename: (session: ChatSessionSummary) => void;
  onCommitRename: (sessionId: string) => void;
  onTogglePin: (sessionId: string, pinned: boolean) => void;
  onDelete: (sessionId: string) => void;
};

function SessionGroup({
  label,
  sessions,
  activeSessionId,
  editingId,
  editValue,
  onEditValueChange,
  onSelect,
  onStartRename,
  onCommitRename,
  onTogglePin,
  onDelete,
}: SessionGroupProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="mb-2">
      {label && (
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-faint">
          {label}
        </p>
      )}

      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        const isEditing = editingId === session.id;

        return (
          <div
            key={session.id}
            className={cn(
              "group flex items-center gap-1 rounded-xl px-2 py-2 text-sm",
              isActive ? "bg-brand-soft text-brand-text" : "hover:bg-surface-subtle",
            )}
          >
            {isEditing ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onBlur={() => onCommitRename(session.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCommitRename(session.id);
                  if (e.key === "Escape") onCommitRename("");
                }}
                className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1 text-sm text-ink focus:outline-none"
              />
            ) : (
              <button
                onClick={() => onSelect(session.id)}
                className="min-w-0 flex-1 truncate text-left font-medium text-ink"
                title={session.title}
              >
                {session.title}
              </button>
            )}

            <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
              <IconAction
                label={session.pinned ? "Unpin" : "Pin"}
                onClick={() => onTogglePin(session.id, !session.pinned)}
              >
                {session.pinned ? (
                  <PinOff className="h-3.5 w-3.5" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
              </IconAction>

              <IconAction label="Rename" onClick={() => onStartRename(session)}>
                <Pencil className="h-3.5 w-3.5" />
              </IconAction>

              <IconAction label="Delete" onClick={() => onDelete(session.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconAction>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Pricing", to: "/pricing" },
  { label: "Help", to: "/help" },
  { label: "About", to: "/about" },
];

/** Pages and account controls, moved here from the site header -- the
 *  chat route no longer renders one. */
function SidebarFooter({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="mt-auto border-t border-border p-2">
      <nav className="flex flex-col">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className="rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-surface-subtle hover:text-ink"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-2 flex items-center gap-2 border-t border-border px-3 pt-3">
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
          <span className="text-sm text-ink-muted">Account</span>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="w-full rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-black">
              Sign in
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-surface-subtle hover:text-ink"
    >
      {children}
    </button>
  );
}
