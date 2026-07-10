import { useMemo } from "react";
import { SearchX } from "lucide-react";
import { Accordion } from "../ui/Accordion";
import { helpArticles, helpCategories } from "./help.data";

interface FaqAccordionProps {
  search: string;
  categoryId: string | null;
}

export function FaqAccordion({ search, categoryId }: FaqAccordionProps) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return helpArticles.filter((article) => {
      const matchesCategory = !categoryId || article.categoryId === categoryId;
      const matchesSearch =
        !q ||
        article.question.toLowerCase().includes(q) ||
        article.answer.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, categoryId]);

  if (filtered.length === 0) {
    return (
      <div className="card-surface flex flex-col items-center px-8 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-sunken text-ink-faint">
          <SearchX className="h-5 w-5" strokeWidth={2} />
        </span>
        <h3 className="mt-4 text-md font-semibold text-ink">No matching articles</h3>
        <p className="mt-1.5 max-w-[36ch] text-sm text-ink-muted">
          Try a different search term, or browse all topics using the
          categories above.
        </p>
      </div>
    );
  }

  const groups = categoryId
    ? [categoryId]
    : Array.from(new Set(filtered.map((a) => a.categoryId)));

  return (
    <div className="space-y-10">
      {groups.map((groupId) => {
        const category = helpCategories.find((c) => c.id === groupId);
        const items = filtered.filter((a) => a.categoryId === groupId);
        if (items.length === 0) return null;

        return (
          <div key={groupId}>
            {category && (
              <div className="mb-4 flex items-center gap-2.5">
                <category.icon className="h-4 w-4 text-brand" strokeWidth={2.25} />
                <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {category.label}
                </h3>
              </div>
            )}

            <Accordion
              items={items.map((a) => ({ id: a.id, question: a.question, answer: a.answer }))}
            />
          </div>
        );
      })}
    </div>
  );
}
