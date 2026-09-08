import { Hero } from "@/components/landing/Hero";
import { MarketsSection } from "@/components/landing/MarketsSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { FinalCta } from "@/components/landing/FinalCta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <MarketsSection />
      <StatsSection />
      <FeaturesGrid />
      <HowItWorks />
      <SecuritySection />
      <FinalCta />
    </>
  );
}
