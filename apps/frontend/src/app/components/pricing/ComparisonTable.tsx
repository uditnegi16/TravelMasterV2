import { Check, Minus } from "lucide-react";

const rows: { feature: string; free: boolean | string; premium: boolean | string }[] = [
  { feature: "AI trip planning conversations", free: "Unlimited", premium: "Unlimited" },
  { feature: "Real flight & hotel search", free: true, premium: true },
  { feature: "Voice input", free: true, premium: true },
  { feature: "PDF export & sharing", free: true, premium: true },
  { feature: "Chat history", free: true, premium: true },
  { feature: "Response speed", free: "Standard", premium: "Priority" },
  { feature: "Multi-city itineraries", free: false, premium: true },
  { feature: "Early access to new features", free: false, premium: true },
  { feature: "Support", free: "Community", premium: "Priority" },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-accent-greenSoft text-accent-green">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    ) : (
      <Minus className="mx-auto h-4 w-4 text-ink-faint" />
    );
  }
  return <span className="text-sm font-medium text-ink">{value}</span>;
}

export function ComparisonTable() {
  return (
    <div className="mx-auto max-w-[900px] overflow-x-auto">
      <div className="card-surface min-w-[560px] overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_140px] items-center gap-4 border-b border-border bg-surface-subtle px-6 py-4">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-faint">
            Feature
          </span>
          <span className="text-center text-xs font-semibold uppercase tracking-[0.06em] text-ink-faint">
            Free
          </span>
          <span className="text-center text-xs font-semibold uppercase tracking-[0.06em] text-brand">
            Premium
          </span>
        </div>

        {rows.map((row, i) => (
          <div
            key={row.feature}
            className={`grid grid-cols-[1fr_140px_140px] items-center gap-4 px-6 py-4 ${
              i !== rows.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="text-sm text-ink">{row.feature}</span>
            <span className="text-center">
              <Cell value={row.free} />
            </span>
            <span className="text-center">
              <Cell value={row.premium} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
