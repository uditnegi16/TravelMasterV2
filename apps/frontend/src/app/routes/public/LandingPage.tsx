import { HeroSection } from "../../components/landing/HeroSection";
import { PreviewPanel } from "../../components/landing/PreviewPanel";
import { HowItWorks } from "../../components/landing/HowItWorks";
import { TrustSection } from "../../components/landing/TrustSection";
import { CtaBand } from "../../components/landing/CtaBand";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <main>
        <HeroSection />

        <section className="relative bg-white pb-20 md:pb-28 -mt-6 md:-mt-10">
          <div className="mx-auto max-w-[1120px] px-4 md:px-8">
            <PreviewPanel />
          </div>
        </section>

        <HowItWorks />

        <TrustSection />

        <CtaBand />
      </main>
    </div>
  );
}