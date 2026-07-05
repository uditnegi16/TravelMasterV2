import { motion, AnimatePresence } from "framer-motion";

interface Props {
  visible: boolean;
  message: string;
}

export default function AiThinkingLoader({
  visible,
  message,
}: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center"
        >
          <motion.div
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 10,
              ease: "linear",
              repeat: Infinity,
            }}
            className="relative flex h-24 w-24 items-center justify-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.18, 1],
                opacity: [0.35, 0.8, 0.35],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
              className="absolute h-24 w-24 rounded-full bg-brand/10 blur-xl"
            />

            <motion.div
              animate={{
                rotate: [0, 180, 360],
                scale: [1, 1.12, 1],
              }}
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
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
            className="mt-8 text-xl font-semibold text-ink"
          >
            Thinking...
          </motion.h3>

          <motion.p
            key={message}
            initial={{ opacity: 0, y: 8 }}
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