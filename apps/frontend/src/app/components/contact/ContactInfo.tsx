import { Mail, Clock, MessageSquare, MapPin } from "lucide-react";

const items = [
  {
    icon: Mail,
    title: "Email us",
    detail: "support@travelmaster.ai",
    tone: "text-brand bg-brand-soft",
  },
  {
    icon: MessageSquare,
    title: "Live chat",
    detail: "Ask TravelMaster directly in the chat",
    tone: "text-accent-teal bg-accent-tealSoft",
  },
  {
    icon: Clock,
    title: "Response time",
    detail: "Usually within 24 hours",
    tone: "text-accent-amber bg-accent-amberSoft",
  },
  {
    icon: MapPin,
    title: "Based in",
    detail: "Remote-first, worldwide",
    tone: "text-accent-green bg-accent-greenSoft",
  },
];

export function ContactInfo() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="card-surface flex items-start gap-4 p-5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
            <item.icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
