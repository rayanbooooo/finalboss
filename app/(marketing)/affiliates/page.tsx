import { AffiliateHero } from "@/components/affiliates/AffiliateHero";
import { AffiliateHowItWorks } from "@/components/affiliates/AffiliateHowItWorks";
import { ProgramStatus } from "@/components/affiliates/ProgramStatus";
import { AffiliateTiers } from "@/components/affiliates/AffiliateTiers";
import { AffiliateDashboard } from "@/components/affiliates/AffiliateDashboard";

export default function AffiliatesPage() {
  return (
    <>
      <AffiliateHero />
      {/* The dashboard renders its own signed-out state, so the sections around
          it are the same either way - a visitor who has not signed in still
          gets the whole story rather than a bare gate. */}
      <div className="px-4 pb-4 sm:px-6 lg:px-8">
        <AffiliateDashboard />
      </div>
      <ProgramStatus />
      <AffiliateHowItWorks />
      <AffiliateTiers />
    </>
  );
}
