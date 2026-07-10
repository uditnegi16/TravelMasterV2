import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../../../lib/cn";

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

interface LegalLayoutProps {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  sections: LegalSection[];
}

export function LegalLayout({ eyebrow, title, lastUpdated, intro, sections }: LegalLayoutProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="bg-white">
      <section className="border-b border-border bg-surface-subtle py-14 md:py-16">
        <div className="mx-auto max-w-[900px] px-4 md:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-ink-faint">Last updated: {lastUpdated}</p>
          {intro && <p className="mt-5 max-w-[70ch] leading-relaxed text-ink-muted">{intro}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-4 py-14 md:px-8 md:py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[220px_1fr]">
          <nav className="hidden md:block">
            <div className="sticky top-24 space-y-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-faint">
                On this page
              </p>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition-colors",
                    activeId === s.id
                      ? "bg-brand-soft font-semibold text-brand"
                      : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
                  )}
                >
                  {s.title}
                </a>
              ))}
            </div>
          </nav>

          <div className="min-w-0 space-y-12">
            {sections.map((s) => (
              <div key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="font-display text-xl font-bold text-ink md:text-2xl">
                  {s.title}
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-ink-muted">
                  {s.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface-subtle py-10">
        <div className="mx-auto max-w-[900px] px-4 text-center text-sm text-ink-faint md:px-8">
          Questions about this policy? Reach out on the{" "}
          <a href="/contact" className="font-semibold text-brand hover:underline">
            Contact page
          </a>
          .
        </div>
      </section>
    </div>
  );
}
