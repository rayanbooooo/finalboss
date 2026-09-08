import { AffiliateHero } from "@/components/affiliates/AffiliateHero";
import { AffiliateStats } from "@/components/affiliates/AffiliateStats";
import { AffiliateTiers } from "@/components/affiliates/AffiliateTiers";
import { ReferralLinkBox } from "@/components/affiliates/ReferralLinkBox";

export default function AffiliatesPage() {
  return (
    <>
      <AffiliateHero />
      <AffiliateStats />
      <AffiliateTiers />
      <div className="px-4 pb-20 sm:px-6 lg:px-8">
        <ReferralLinkBox />
      </div>
    </>
  );
}
