import TripResult from "../trip/TripResult";
import type { Trip } from "../../models/trip";
import { Download, Share2 } from "lucide-react";
import { API_URL } from "../../services/api";
import { useAuth } from "@clerk/clerk-react";
type ChatTurnProps = {
  messageId: string;
  role: "user" | "assistant" | "system";
  message: string;
  tripData?: Trip | null;
};

export default function ChatTurn({
  messageId,
  role,
  message,
  tripData,
}: ChatTurnProps) {
  const isUser = role === "user";
  const isSystem = role === "system";
  const { getToken } = useAuth();

  const handleDownloadPdf = async () => {
    const token = await getToken();
    if (!token) {
      alert("Sign in to download a PDF of this trip.");
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
      alert("Couldn't generate the PDF. Please try again.");
      return;
    }

    const data = await response.json();
    window.open(data.url, "_blank");
  };

  const handleShare = async () => {
    const token = await getToken();
    if (!token) {
      alert("Sign in to share this trip.");
      return;
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
      alert("Couldn't create a share link. Please try again.");
      return;
    }

    const data = await response.json();
    await navigator.clipboard.writeText(data.url);
    alert("Public share link copied to clipboard.");
  };
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
        <p className="whitespace-pre-wrap leading-7">
          {message}
        </p>
      </div>

      {tripData && (
  <>
    <TripResult
      result={{
        trip: tripData,
      }}
      />

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </>
  )}
    </div>
  );
}