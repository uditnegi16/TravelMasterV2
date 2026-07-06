import ChatTurn from "./ChatTurn";

export type ConversationMessage = {
  role: "user" | "assistant";
  message: string;
};

type ChatThreadProps = {
  messages: ConversationMessage[];
};

export default function ChatThread({
  messages,
}: ChatThreadProps) {
  if (!messages.length) return null;

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-white p-6 shadow-soft">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Conversation
      </h2>

      <div className="space-y-4">
        {messages.map((msg, index) => (
          <ChatTurn
            key={index}
            role={msg.role}
            message={msg.message}
          />
        ))}
      </div>
    </section>
  );
}