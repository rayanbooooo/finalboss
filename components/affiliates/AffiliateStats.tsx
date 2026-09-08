import { StatsCounter } from "@/components/landing/StatsCounter";
import { AFFILIATE_STATS_SEED } from "@/lib/mockData";
import { Reveal } from "@/components/ui/Reveal";

export function AffiliateStats() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <Reveal className="mx-auto grid max-w-5xl grid-cols-1 gap-8 border-y border-white/[0.07] py-10 sm:grid-cols-3 sm:divide-x sm:divide-white/[0.07]">
        <div className="sm:pr-8">
          <StatsCounter
            label="Total Paid Out"
            seed={AFFILIATE_STATS_SEED.totalPaidOut}
            prefix="$"
            nudgeMax={800}
          />
        </div>
        <div className="sm:px-8">
          <StatsCounter
            label="Active Affiliates"
            seed={AFFILIATE_STATS_SEED.activeAffiliates}
            nudgeMax={1}
          />
        </div>
        <div className="sm:pl-8">
          <StatsCounter
            label="Avg. Monthly Commission"
            seed={AFFILIATE_STATS_SEED.avgCommission}
            prefix="$"
            nudgeMax={5}
          />
        </div>
      </Reveal>
    </section>
  );
}
