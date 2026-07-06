type ChatTurnProps = {
  role: "user" | "assistant";
  message: string;
};

export default function ChatTurn({
  role,
  message,
}: ChatTurnProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-soft ${
          isUser
            ? "bg-brand text-white"
            : "border border-border bg-white text-ink"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-7">
          {message}
        </p>
      </div>
    </div>
  );
}