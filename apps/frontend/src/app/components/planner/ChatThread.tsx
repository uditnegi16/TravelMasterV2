import ChatTurn from "./ChatTurn";
import type { Trip } from "../../models/trip";
export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  trip_data?: Trip | null;
  created_at: string;
};

type ChatThreadProps = {
  messages: ChatMessage[];
  streamingText?: string;
};

export default function ChatThread({
  messages,
  streamingText = "",
}: ChatThreadProps) {
  return (
    <section className="space-y-5">
      {messages.map((message) => (
        <ChatTurn
            key={message.id}
            messageId={message.id}
            role={message.role}
            message={message.content}
            tripData={message.trip_data}
          />
      ))}

      {streamingText && (
        <ChatTurn
          messageId=""
          role="assistant"
          message={streamingText}
          tripData={null}
        />
      )}
    </section>
  );
}