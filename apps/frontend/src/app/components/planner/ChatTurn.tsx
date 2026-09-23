import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TripResult from "../trip/TripResult";
import type { Trip } from "../../models/trip";
import { Download, Share2, Link2, Mail, MessageCircle, Check, ChevronDown } from "lucide-react";
import { API_URL } from "../../services/api";
import { useAuth } from "@clerk/clerk-react";
type ChatTurnProps = {
  messageId: string;
  role: "user" | "assistant" | "system";
  message: string;
  tripData?: Trip | null;
};

type Feedback = { tone: "success" | "error"; text: string } | null;
type MenuPos = { top: number; left: number } | null;

export default function ChatTurn({
  messageId,
  role,
  message,
  tripData,
}: ChatTurnProps) {
  const isUser = role === "user";
  const isSystem = role === "system";
  const { getToken } = useAuth();

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>(null);

  function flashFeedback(next: Feedback) {
    setFeedback(next);
    if (next) setTimeout(() => setFeedback(null), 3000);
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const token = await getToken();
      if (!token) {
        flashFeedback({ tone: "error", text: "Sign in to download a PDF of this trip." });
        return;
      }

      // window.open() can't attach an Authorization header, so this
      // route (correctly requires auth + ownership as of Issue 3) has to
      // go through fetch instead. Backend returns the presigned S3 URL
      // as JSON (not an HTTP redirect) specifically so this stays a
      // same-origin API call -- no dependency on the S3 bucket having
      // CORS configured for this frontend's origin.
      const response = await fetch(
        `${API_URL}/chat/messages/${messageId}/pdf`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) {
        flashFeedback({ tone: "error", text: "Couldn't generate the PDF. Please try again." });
        return;
      }

      const data = await response.json();
      window.open(data.url, "_blank");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Unchanged endpoint/contract — same POST, same auth header, same JSON
  // shape. The only thing that's new is what the frontend does with the
  // URL it gets back: instead of only clipboard + alert(), it now also
  // offers WhatsApp and email, both plain client-side links built from
  // this same value. No new backend call for either.
  async function getShareUrl(): Promise<string | null> {
    const token = await getToken();
    if (!token) {
      flashFeedback({ tone: "error", text: "Sign in to share this trip." });
      return null;
    }

    const response = await fetch(
      `${API_URL}/chat/messages/${messageId}/share`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      flashFeedback({ tone: "error", text: "Couldn't create a share link. Please try again." });
      return null;
    }

    const data = await response.json();
    return data.url as string;
  }

  async function handleCopyLink() {
    setShareBusy(true);
    try {
      const url = await getShareUrl();
      if (!url) return;
      await navigator.clipboard.writeText(url);
      flashFeedback({ tone: "success", text: "Link copied to clipboard." });
      setShareOpen(false);
    } finally {
      setShareBusy(false);
    }
  }

  async function handleShareWhatsApp() {
    setShareBusy(true);
    try {
      const url = await getShareUrl();
      if (!url) return;
      const text = encodeURIComponent(`Check out my trip plan: ${url}`);
      window.open(`https://wa.me/?text=${text}`, "_blank");
      setShareOpen(false);
    } finally {
      setShareBusy(false);
    }
  }

  async function handleShareEmail() {
    setShareBusy(true);
    try {
      const url = await getShareUrl();
      if (!url) return;
      const subject = encodeURIComponent("My trip plan on TravelMaster");
      const body = encodeURIComponent(`Here's the trip I planned: ${url}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      setShareOpen(false);
    } finally {
      setShareBusy(false);
    }
  }

  // Closes the menu on any scroll or resize while it's open, so it
  // never sits frozen at a stale screen position after the button
  // (and everything else) has moved under it.
  useEffect(() => {
    if (!shareOpen) return;

    function close() {
      setShareOpen(false);
    }

    window.addEventListener("scroll", close, true); // capture: catches the
    // message list's own overflow-y-auto scroll too, since scroll
    // events don't bubble but capture-phase listeners still see them.
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [shareOpen]);

  function toggleShareMenu() {
    if (shareOpen) {
      setShareOpen(false);
      return;
    }
    // Computed from the button's actual screen position rather than
    // CSS absolute-positioning relative to an ancestor -- that
    // approach gets clipped by the message list's `overflow-y-auto`
    // whenever the button sits near the bottom of the scrollable
    // area, which is exactly where it usually is (right after the
    // newest trip card). Portaling to document.body with fixed
    // coords sidesteps that clipping regardless of scroll position.
    //
    // The button now sits at the right edge of the trip card header, so
    // right-align the menu to it and keep it inside the viewport; open
    // upward instead if there isn't room below.
    const rect = shareButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const MENU_W = 208; // w-52
      const MENU_H = 164; // 3 rows
      const GAP = 8;
      const EDGE = 12;
      const left = Math.min(
        Math.max(EDGE, rect.right - MENU_W),
        window.innerWidth - MENU_W - EDGE,
      );
      const fitsBelow = rect.bottom + GAP + MENU_H <= window.innerHeight - EDGE;
      const top = fitsBelow ? rect.bottom + GAP : Math.max(EDGE, rect.top - GAP - MENU_H);
      setMenuPos({ top, left });
    }
    setShareOpen(true);
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-brand px-5 py-4 shadow-raised">
            <p className="whitespace-pre-wrap break-words text-base font-medium leading-7 text-white">
                {message}
            </p>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
          <p className="whitespace-pre-wrap leading-7">
            {message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-border bg-surface-subtle px-5 py-4 text-ink">
        <FormattedMessage text={message} />
      </div>

      {tripData && (
        <TripResult
          result={{ trip: tripData }}
          actions={
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-[#12141c] dark:hover:bg-white/90"
                >
                  <Download className="h-4 w-4" />
                  {downloadingPdf ? "Preparing..." : "PDF"}
                </button>

                <button
                  ref={shareButtonRef}
                  type="button"
                  onClick={toggleShareMenu}
                  aria-expanded={shareOpen}
                  aria-haspopup="menu"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand-text transition hover:bg-brand-softer"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${shareOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {feedback && (
                <span
                  role="status"
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    feedback.tone === "success" ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {feedback.tone === "success" && <Check className="h-3.5 w-3.5" />}
                  {feedback.text}
                </span>
              )}

              {shareOpen && menuPos &&
                createPortal(
                  <>
                    {/* click-away backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShareOpen(false)}
                    />
                    <div
                      style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
                      className="z-50 w-52 overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-raised animate-fadeIn"
                    >
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        disabled={shareBusy}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-surface-subtle disabled:opacity-60"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
                          <Link2 className="h-3.5 w-3.5" />
                        </span>
                        Copy link
                      </button>

                      <button
                        type="button"
                        onClick={handleShareWhatsApp}
                        disabled={shareBusy}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-surface-subtle disabled:opacity-60"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-tealSoft text-accent-teal">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </span>
                        WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={handleShareEmail}
                        disabled={shareBusy}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-surface-subtle disabled:opacity-60"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
                          <Mail className="h-3.5 w-3.5" />
                        </span>
                        Email
                      </button>
                    </div>
                  </>,
                  document.body,
                )}
            </div>
          }
        />
      )}
    </div>
  );
}


/** The composer emits light markdown (**bold** headings, blank-line
 *  paragraphs) but nothing rendered it, so users saw literal asterisks:
 *  "**Day 1 - Arrival & Ueno**". This renders the small subset actually
 *  produced, building React nodes rather than injecting HTML, so there
 *  is no XSS surface and no new dependency. */
function FormattedMessage({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);

  return (
    <div className="space-y-3">
      {paragraphs.map((para, pi) => (
        <p key={pi} className="whitespace-pre-wrap leading-7">
          {para.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
            part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
              <strong key={i} className="font-semibold text-ink">
                {part.slice(2, -2)}
              </strong>
            ) : (
              part
            ),
          )}
        </p>
      ))}
    </div>
  );
}