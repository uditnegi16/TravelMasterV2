import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { Plus, Pin, PinOff, Pencil, Trash2, LogIn, X, Settings, Sun, Moon, Monitor, Check } from "lucide-react";

import { cn } from "../../../lib/cn";
import { useTheme } from "../../../lib/useTheme";
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

  // Closed means closed: no rail. Gemini shows nothing when the drawer
  // is shut and reopens from the chat header's menu button. The old
  // w-14 rail was a second, competing control for the same thing.
  if (collapsed) {
    return null;
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

      <div className="fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-border bg-surface md:relative md:z-auto">
        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-base font-semibold text-brand">
              TravelMaster
            </span>
            <button
              aria-label="Close menu"
              onClick={() => setCollapsed(true)}
              className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-subtle hover:text-ink"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <button
            onClick={onNewChat}
            className="mt-3 flex w-full items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            <Plus className="h-4 w-4" />
            New chat
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

const THEME_OPTIONS = [
  { value: "system" as const, label: "System", Icon: Monitor },
  { value: "light" as const, label: "Light", Icon: Sun },
  { value: "dark" as const, label: "Dark", Icon: Moon },
];

const NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Pricing", to: "/pricing" },
  { label: "Help", to: "/help" },
  { label: "About", to: "/about" },
];

/** Pages and account controls, moved here from the site header -- the
 *  chat route no longer renders one. */
function SidebarFooter({ onNavigate }: { onNavigate: () => void }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="mt-auto border-t border-border bg-surface p-2">
      {settingsOpen && (
        <div className="mb-2 rounded-xl border border-border bg-surface-raised p-1 shadow-card">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => {
                setSettingsOpen(false);
                onNavigate();
              }}
              className="block rounded-lg px-3 py-2 text-sm text-ink transition hover:bg-surface-subtle"
            >
              {item.label}
            </Link>
          ))}

          <div className="my-1 border-t border-border" />

          <p className="px-3 pb-1 pt-2 text-xs font-medium text-ink-faint">
            Theme
          </p>
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink transition hover:bg-surface-subtle"
            >
              <Icon className="h-4 w-4 text-ink-muted" />
              <span className="flex-1 text-left">{label}</span>
              {theme === value && <Check className="h-4 w-4 text-brand" />}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-1">
        <SignedIn>
          {/* The avatar itself opens Clerk's menu, which holds Manage
              account and Sign out -- so a separate sign-out button was
              a second control for something already there. */}
          <UserButton
            afterSignOutUrl="/"
            appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }}
          />
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            Your account
          </span>
        </SignedIn>

        <SignedOut>
          <SignInButton mode="modal">
            <button className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover">
              <LogIn className="h-4 w-4" />
              Sign in
            </button>
          </SignInButton>
        </SignedOut>

        <button
          aria-label="Settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted transition hover:bg-surface-subtle hover:text-ink"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
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
