import { HeroSection } from "../../components/landing/HeroSection";
import { PreviewPanel } from "../../components/landing/PreviewPanel";
import { StatsSection } from "../../components/landing/StatsSection";
import { HowItWorks } from "../../components/landing/HowItWorks";
import { WhySection } from "../../components/landing/WhySection";
import { TravelStyles } from "../../components/landing/TravelStyles";
import { TrustSection } from "../../components/landing/TrustSection";
import { FaqSection } from "../../components/landing/FaqSection";
import { CtaBand } from "../../components/landing/CtaBand";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <main>
        <HeroSection />

        <section className="relative bg-white pb-16 md:pb-20 -mt-12 md:-mt-16">
          <div className="mx-auto max-w-[1120px] px-4 md:px-8">
            <PreviewPanel />
          </div>
        </section>

        <StatsSection />

        <HowItWorks />

        <WhySection />

        <TravelStyles />

        <TrustSection />

        <FaqSection />

        <CtaBand />
      </main>
    </div>
  );
}