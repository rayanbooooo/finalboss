import { StatsCounter } from "@/components/landing/StatsCounter";
import { AFFILIATE_STATS_SEED } from "@/lib/mockData";
import { GlassCard } from "@/components/ui/GlassCard";

export function AffiliateStats() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <GlassCard className="mx-auto grid max-w-5xl grid-cols-1 gap-8 p-8 sm:grid-cols-3 sm:p-12">
        <StatsCounter
          label="Total Paid Out"
          seed={AFFILIATE_STATS_SEED.totalPaidOut}
          prefix="$"
          nudgeMax={800}
        />
        <StatsCounter
          label="Active Affiliates"
          seed={AFFILIATE_STATS_SEED.activeAffiliates}
          nudgeMax={1}
        />
        <StatsCounter
          label="Avg. Monthly Commission"
          seed={AFFILIATE_STATS_SEED.avgCommission}
          prefix="$"
          nudgeMax={5}
        />
      </GlassCard>
    </section>
  );
}
