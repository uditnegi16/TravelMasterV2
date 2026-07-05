import type { ProgressEvent } from "../../../lib/websocket";

interface Props {
  events: ProgressEvent[];
}

export default function TripProgressTracker({
  events,
}: Props) {
  if (!events.length) return null;

  return (
    <div className="mt-8 rounded-3xl border border-border bg-white p-6 shadow-soft animate-fadeIn">
      <h2 className="mb-5 text-lg font-semibold text-ink">
        Planning Progress
      </h2>

      <div className="space-y-3">
        {events.map((event, index) => (
          <div
            key={`${event.stage}-${index}`}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
          >
            <span className="capitalize text-ink">
              {event.message ?? event.stage}
            </span>

            <span
              className={`text-sm font-medium ${
                event.status === "completed"
                  ? "text-green-600"
                  : event.status === "failed"
                  ? "text-red-600"
                  : "text-brand"
              }`}
            >
              {event.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}