import { Hero } from "@/components/landing/Hero";
import { StatsSection } from "@/components/landing/StatsSection";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsSection />
      <FeaturesGrid />
      <HowItWorks />
    </>
  );
}
