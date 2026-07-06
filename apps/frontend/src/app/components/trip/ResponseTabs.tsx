import { useState } from "react";
import type { ReactNode } from "react";

const RESULT_TABS = [
  "Summary",
  "Flights",
  "Hotels",
  "Places",
  "Weather",
];


type Props = {
  children: ReactNode[];
};

export default function ResponseTabs({
  children,
}: Props) {
  const [active, setActive] = useState(0);

  return (
    <>
      <div
        role="tablist"
        className="mb-6 flex gap-2 overflow-x-auto pb-1 rail-scroll">
        {RESULT_TABS.map((tab, index) => (
          <button
          key={tab}
          role="tab"
          aria-selected={active === index}
          aria-controls={`tabpanel-${index}`}
          id={`tab-${index}`}
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

      <div
        role="tabpanel"
        id={`tabpanel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="animate-fadeIn"
      >
        {children[active] ?? null}
      </div>
    </>
  );
}