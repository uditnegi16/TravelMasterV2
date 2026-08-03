import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface Props {
  visible: boolean;
  message: string;
}

export default function AiThinkingLoader({
  visible,
  message,
}: Props) {
  const prefersReducedMotion = useReducedMotion();

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
          {/* Purely decorative -- the actual "still working" signal for
              screen reader users is the aria-live status text below,
              not this animation. */}
          <div aria-hidden="true">
            <motion.div
              animate={prefersReducedMotion ? {} : { rotate: 360 }}
              transition={{
                duration: 10,
                ease: "linear",
                repeat: Infinity,
              }}
              className="relative flex h-24 w-24 items-center justify-center"
            >
              <motion.div
                animate={
                  prefersReducedMotion
                    ? {}
                    : { scale: [1, 1.18, 1], opacity: [0.35, 0.8, 0.35] }
                }
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
                className="absolute h-24 w-24 rounded-full bg-brand/10 blur-xl"
              />

              <motion.div
                animate={
                  prefersReducedMotion
                    ? {}
                    : { rotate: [0, 180, 360], scale: [1, 1.12, 1] }
                }
                transition={{
                  duration: 3,
                  repeat: Infinity,
                }}
                className="text-5xl text-brand"
              >
                ✦
              </motion.div>
            </motion.div>

            <motion.h3
              animate={prefersReducedMotion ? {} : { opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
              }}
              className="mt-8 text-xl font-semibold text-ink"
            >
              Thinking...
            </motion.h3>
          </div>

          {/* The real status announcement -- changes only when the
              backend's progress stage actually changes (e.g. "Searching
              flights..." -> "Searching hotels..."), not per streamed
              token, which would be far too noisy for a screen reader
              user to follow. */}
          <motion.p
            key={message}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-center text-sm text-ink-muted"
          >
            {message}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}