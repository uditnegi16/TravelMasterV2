import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AiPromptBox } from "../input/AiPromptBox";
import { Chip } from "../ui/Chip";
import { Button } from "../ui/Button";
import { RoutePathDecoration } from "./RoutePathDecoration";

const examplePrompts = [
  "Weekend in Lisbon on a budget",
  "7 days in Japan for 2 travelers",
  "Best time to visit Bali",
  "Add Kyoto to my Tokyo trip",
];

export function HeroSection() {
  const navigate = useNavigate();

  function goToPlanner(prompt?: string) {
    navigate("/plan", { state: prompt ? { prompt } : undefined });
  }

  return (
    <section className="relative overflow-hidden bg-dot-grid">
      <RoutePathDecoration />
      <div className="relative mx-auto max-w-[820px] px-4 pb-14 pt-16 md:pb-20 md:pt-20 text-center md:px-8 md:pb-28 md:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted animate-fadeUp">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
          AI travel planner, not a search engine
        </span>

        <h1
          className="mt-6 font-display text-4xl font-semibold tracking-[-0.02em] text-ink md:text-5xl animate-fadeUp"
          style={{ animationDelay: "60ms" }}
        >
          Tell it where you want to go.
          <br className="hidden sm:block" /> It plans the rest.
        </h1>

        <p
          className="mx-auto mt-5 max-w-[52ch] text-md text-ink-muted md:text-lg animate-fadeUp"
          style={{ animationDelay: "120ms" }}
        >
          Describe a trip like you'd tell a friend. TravelMaster finds real
          flights and hotels, builds a day-by-day plan, and keeps adjusting
          as you keep talking.
        </p>

        <div className="mt-9 animate-fadeUp" style={{ animationDelay: "180ms" }}>
          <AiPromptBox size="hero" onSubmit={(prompt) => goToPlanner(prompt)} />
        </div>

        <div
          className="mt-5 flex flex-wrap items-center justify-center gap-2 animate-fadeUp"
          style={{ animationDelay: "220ms" }}
        >
          {examplePrompts.map((prompt) => (
            <Chip key={prompt} onClick={() => goToPlanner(prompt)}>
              {prompt}
            </Chip>
          ))}
        </div>

        <div
          className="mt-10 flex flex-col items-center gap-3 animate-fadeUp"
          style={{ animationDelay: "260ms" }}
        >
          <Button
            variant="secondary"
            size="lg"
            icon={<ArrowRight className="h-[18px] w-[18px]" />}
            iconPosition="right"
            onClick={() => goToPlanner()}
          >
            Start planning — it's free
          </Button>
          <span className="text-xs text-ink-faint">
            No credit card. No account needed to try it.
          </span>
        </div>
      </div>
    </section>
  );
}
