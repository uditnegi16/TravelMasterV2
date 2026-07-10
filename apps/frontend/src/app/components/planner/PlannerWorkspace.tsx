import { AiPromptBox } from "../input/AiPromptBox";
import AiThinkingLoader from "../loading/AiThinkingLoader";
import StreamingPanel from "./StreamingPanel";
import PdfStatusCard from "./PdfStatusCard";

type PdfStatus = "idle" | "generating" | "ready" | "error";

type PlannerWorkspaceProps = {
  loading: boolean;
  currentMessage: string;
  streamingText: string;
  pdfStatus: PdfStatus;
  pdfUrl: string | null;
  onSubmit: (query: string) => void | Promise<void>;
};

export default function PlannerWorkspace({
  loading,
  currentMessage,
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
          message={currentMessage}
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