import { useState } from "react";

const tabs = [
  "Summary",
  "Flights",
  "Hotels",
  "Places",
  "Weather",
];

type Props = {
  children: React.ReactNode[];
};

export default function ResponseTabs({
  children,
}: Props) {
  const [active, setActive] = useState(0);

  return (
    <>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 rail-scroll">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            onClick={() => setActive(index)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              active === index
                ? "bg-ink text-white"
                : "border border-border bg-white text-ink-muted hover:bg-surface-subtle hover:text-ink"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="animate-fadeIn">
        {children[active]}
      </div>
    </>
  );
}