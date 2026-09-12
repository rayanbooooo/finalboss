import { AffiliateHero } from "@/components/affiliates/AffiliateHero";
import { AffiliateTiers } from "@/components/affiliates/AffiliateTiers";
import { AffiliateDashboard } from "@/components/affiliates/AffiliateDashboard";

export default function AffiliatesPage() {
  return (
    <>
      <AffiliateHero />
      <div className="px-4 pb-16 sm:px-6 lg:px-8">
        <AffiliateDashboard />
      </div>
      <AffiliateTiers />
    </>
  );
}
