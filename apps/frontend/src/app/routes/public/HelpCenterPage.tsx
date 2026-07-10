import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { HelpSearchBar } from "../../components/help/HelpSearchBar";
import { HelpCategories } from "../../components/help/HelpCategories";
import { FaqAccordion } from "../../components/help/FaqAccordion";
import { ContactSupportCta } from "../../components/help/ContactSupportCta";

export default function HelpCenterPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-dot-grid bg-white py-16 md:py-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-brand-softer via-white to-white" />

        <div className="relative mx-auto max-w-[720px] px-4 text-center md:px-8">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-soft">
            <LifeBuoy className="h-5 w-5" strokeWidth={2.25} />
          </span>

          <h1 className="mt-6 font-display text-4xl font-bold text-ink md:text-5xl">
            How can we help?
          </h1>

          <p className="mx-auto mt-4 max-w-[46ch] text-md leading-relaxed text-ink-muted">
            Search the Help Center or browse by topic below.
          </p>

          <HelpSearchBar value={search} onChange={setSearch} className="mt-8" />
        </div>
      </section>

      <section className="mx-auto max-w-[900px] px-4 pb-24 md:px-8">
        <HelpCategories activeId={categoryId} onSelect={setCategoryId} />

        <div className="mt-10">
          <FaqAccordion search={search} categoryId={categoryId} />
        </div>

        <div className="mt-14">
          <ContactSupportCta />
        </div>
      </section>
    </div>
  );
}
