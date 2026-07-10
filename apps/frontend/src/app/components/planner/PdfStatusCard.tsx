type PdfStatus = "idle" | "generating" | "ready" | "error";

type PdfStatusCardProps = {
  status: PdfStatus;
  pdfUrl: string | null;
};

export default function PdfStatusCard({
  status,
  pdfUrl,
}: PdfStatusCardProps) {
  if (status === "idle") return null;

  return (
    <div className="mt-6 animate-fadeIn card-surface p-7">
      {status === "generating" && (
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" />

          <p className="text-sm text-ink-muted">
            Generating your itinerary PDF...
          </p>
        </div>
      )}

      {status === "ready" && pdfUrl && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              PDF Ready
            </h3>

            <p className="mt-1 text-sm text-ink-muted">
              Your itinerary has been generated successfully.
            </p>
          </div>

          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-hover transition-colors"
          >
            Download PDF
          </a>
        </div>
      )}

      {status === "error" && (
        <div>
          <h3 className="text-sm font-semibold text-red-600">
            PDF Generation Failed
          </h3>

          <p className="mt-2 text-sm text-ink-muted">
            We couldn't generate your itinerary PDF. Your trip results
            are still available above.
          </p>
        </div>
      )}
    </div>
  );
}