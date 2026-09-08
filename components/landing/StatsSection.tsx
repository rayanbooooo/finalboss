import { StatsCounter } from "@/components/landing/StatsCounter";
import { STATS_SEED } from "@/lib/mockData";
import { GlassCard } from "@/components/ui/GlassCard";

export function StatsSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <GlassCard className="mx-auto grid max-w-5xl grid-cols-1 gap-8 p-8 sm:grid-cols-3 sm:p-12">
        <StatsCounter
          label="Total Volume Traded"
          seed={STATS_SEED.totalVolume}
          prefix="$"
          nudgeMax={45000}
        />
        <StatsCounter
          label="Active Traders"
          seed={STATS_SEED.activeTraders}
          nudgeMax={2}
        />
        <StatsCounter
          label="Daily Liquidations Handled"
          seed={STATS_SEED.dailyLiquidations}
          prefix="$"
          nudgeMax={1200}
        />
      </GlassCard>
    </section>
  );
}
