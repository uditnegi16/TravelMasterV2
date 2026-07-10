import { AboutHero } from "../../components/about/AboutHero";
import { MissionVision } from "../../components/about/MissionVision";
import { FeaturesGrid } from "../../components/about/FeaturesGrid";
import { AiWorkflow } from "../../components/about/AiWorkflow";
import { TechStack } from "../../components/about/TechStack";
import { WhyTravelMaster } from "../../components/about/WhyTravelMaster";
import { TeamSection } from "../../components/about/TeamSection";
import { FooterCta } from "../../components/about/FooterCta";

export default function AboutPage() {
  return (
    <div className="bg-white">
      <AboutHero />
      <MissionVision />
      <AiWorkflow />
      <FeaturesGrid />
      <TechStack />
      <WhyTravelMaster />
      {/* Optional — remove until real bios/photos are ready */}
      <TeamSection />
      <FooterCta />
    </div>
  );
}
