import { AiPromptBox } from "../input/AiPromptBox";
import AiThinkingLoader from "../loading/AiThinkingLoader";
import StreamingPanel from "./StreamingPanel";
import PdfStatusCard from "./PdfStatusCard";
import type { ProgressStep } from "../../../lib/websocket";

type PdfStatus = "idle" | "generating" | "ready" | "error";

type PlannerWorkspaceProps = {
  loading: boolean;
  steps: ProgressStep[];
  streamingText: string;
  pdfStatus: PdfStatus;
  pdfUrl: string | null;
  onSubmit: (query: string) => void | Promise<void>;
};

export default function PlannerWorkspace({
  loading,
  steps,
  streamingText,
  pdfStatus,
  pdfUrl,
  onSubmit,
}: PlannerWorkspaceProps) {
return (
  <section className="space-y-8">

    <div className="card-surface p-8">
      <AiPromptBox
        size="hero"
        onSubmit={onSubmit}
        placeholder="Example: Plan a 7-day trip to Bali in August under ₹2.5 lakh..."
      />
    </div>

    {loading && (
      <>
        <AiThinkingLoader
          visible={loading}
          steps={steps}
        />

        <StreamingPanel text={streamingText} />
      </>
    )}

    <PdfStatusCard
      status={pdfStatus}
      pdfUrl={pdfUrl}
    />

  </section>
);
}