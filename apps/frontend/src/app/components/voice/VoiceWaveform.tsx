import { motion } from "framer-motion";
import { cn } from "../../../lib/cn";

interface VoiceWaveformProps {
  /** Whether the bars should animate (actively listening) or sit static */
  active?: boolean;
  bars?: number;
  tone?: "brand" | "inverse";
  className?: string;
}

export function VoiceWaveform({
  active = true,
  bars = 5,
  tone = "brand",
  className,
}: VoiceWaveformProps) {
  const color = tone === "brand" ? "bg-brand" : "bg-white";

  return (
    <div className={cn("flex items-center gap-[3px]", className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className={cn("w-[3px] rounded-full", color)}
          animate={
            active
              ? {
                  height: [6, 18, 9, 22, 6],
                }
              : { height: 6 }
          }
          transition={{
            duration: 1.1,
            repeat: active ? Infinity : 0,
            ease: "easeInOut",
            delay: i * 0.09,
          }}
          style={{ height: 6 }}
        />
      ))}
    </div>
  );
}
