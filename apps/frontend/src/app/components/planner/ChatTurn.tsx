import TripResult from "../trip/TripResult";
import type { PlanTripResponse, Trip } from "../../models/trip";
import { Download, Share2 } from "lucide-react";
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
  const handleDownloadPdf = () => {
    window.open(
      `http://localhost:8000/chat/messages/${messageId}/pdf`,
      "_blank",
    );
  };

  const handleShare = async () => {
  const response = await fetch(
    `http://localhost:8000/chat/messages/${messageId}/share`,
    {
      method: "POST",
    },
  );

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