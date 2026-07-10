import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../lib/cn";

interface AccordionItemData {
  id: string;
  question: string;
  answer: ReactNode;
}

interface AccordionProps {
  items: AccordionItemData[];
  defaultOpenId?: string;
  className?: string;
}

export function Accordion({ items, defaultOpenId, className }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null);

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => {
        const isOpen = openId === item.id;

        return (
          <div
            key={item.id}
            className={cn(
              "card-surface overflow-hidden transition-shadow duration-200",
              isOpen && "shadow-raised"
            )}
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              className="focus-ring flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="text-[0.95rem] font-semibold text-ink md:text-base">
                {item.question}
              </span>

              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-muted transition-transform duration-200",
                  isOpen && "rotate-180 bg-brand-soft text-brand"
                )}
              >
                <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
              </span>
            </button>

            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-5 text-sm leading-relaxed text-ink-muted md:text-[0.95rem]">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
