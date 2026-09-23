import {
  Sparkles,
  Compass,
  MapPin,
  BookOpen,
  ListChecks,
  Plane,
  PencilLine,
  Search,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ProgressStep, StepStatus } from "../../../lib/websocket";

interface Props {
  visible: boolean;
  steps: ProgressStep[];
}

// One icon per real backend stage id (graph/nodes/*.py). Falls back to
// Sparkles for any stage name this list doesn't know about yet, so a
// future node added server-side never renders broken -- just generic.
const STAGE_ICON: Record<string, LucideIcon> = {
  planner: Compass,
  resolver: MapPin,
  rag: BookOpen,
  tool_router: ListChecks,
  tools: Plane,
  composer: Sparkles,
  trip_modifier: PencilLine,
  info_request: Search,
  qa: MessageCircle,
};

const STATUS_STYLES: Record<
  StepStatus,
  { text: string; iconBg: string; iconColor: string }
> = {
  active: { text: "text-ink", iconBg: "bg-brand-soft", iconColor: "text-brand" },
  done: { text: "text-ink-muted", iconBg: "bg-accent-greenSoft", iconColor: "text-accent-green" },
  degraded: { text: "text-ink-muted", iconBg: "bg-accent-amberSoft", iconColor: "text-accent-amber" },
  failed: { text: "text-ink-muted", iconBg: "bg-accent-redSoft", iconColor: "text-accent-red" },
};

function StatusGlyph({ status }: { status: StepStatus }) {
  if (status === "active") return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "degraded") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <XCircle className="h-3.5 w-3.5" />;
}

export default function AiThinkingLoader({
  visible,
  steps,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const activeStep = steps.find((s) => s.status === "active");
  // The real status announcement for screen readers -- changes only
  // when a stage actually starts/finishes, not per streamed token,
  // which would be far too noisy to follow.
  const announcement = activeStep?.label ?? "TravelMaster is thinking...";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -12 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
          className="mt-10 flex flex-col items-center justify-center"
        >
          {/* Purely decorative -- the real "still working" signal for
              screen reader users is the aria-live status text below. */}
          <div aria-hidden="true">
            <motion.div
              animate={prefersReducedMotion ? {} : { rotate: 360 }}
              transition={{ duration: 10, ease: "linear", repeat: Infinity }}
              className="relative flex h-16 w-16 items-center justify-center"
            >
              <motion.div
                animate={
                  prefersReducedMotion
                    ? {}
                    : { scale: [1, 1.18, 1], opacity: [0.35, 0.8, 0.35] }
                }
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute h-16 w-16 rounded-full bg-brand/10 blur-xl"
              />

              <motion.div
                animate={
                  prefersReducedMotion
                    ? {}
                    : { rotate: [0, 180, 360], scale: [1, 1.12, 1] }
                }
                transition={{ duration: 3, repeat: Infinity }}
                className="text-5xl text-brand"
              >
                <Sparkles className="h-5 w-5" />
              </motion.div>
            </motion.div>
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>

          {/* Real per-stage checklist, built only from stages the
              backend has actually reported for this request -- a
              GENERAL_CHAT turn only ever shows one "qa" row, a full
              NEW_TRIP run shows the whole planner->composer chain. */}
          {steps.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">TravelMaster is thinking...</p>
          ) : (
            <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
              {steps.map((step) => {
                const Icon = STAGE_ICON[step.stage] ?? Sparkles;
                const style = STATUS_STYLES[step.status];

                return (
                  <motion.div
                    key={step.stage}
                    initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${style.text}`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style.iconBg} ${style.iconColor}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>

                    <span className="flex-1">{step.label}</span>

                    <span className={style.iconColor}>
                      <StatusGlyph status={step.status} />
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}