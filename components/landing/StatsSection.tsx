import { StatsCounter } from "@/components/landing/StatsCounter";
import { STATS_SEED } from "@/lib/mockData";
import { Reveal } from "@/components/ui/Reveal";

export function StatsSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mx-auto grid max-w-5xl grid-cols-1 gap-8 border-y border-white/[0.07] py-10 sm:grid-cols-3 sm:divide-x sm:divide-white/[0.07]">
        <div className="sm:pr-8">
          <StatsCounter
            label="Total Volume Traded"
            seed={STATS_SEED.totalVolume}
            prefix="$"
            nudgeMax={45000}
          />
        </div>
        <div className="sm:px-8">
          <StatsCounter label="Active Traders" seed={STATS_SEED.activeTraders} nudgeMax={2} />
        </div>
        <div className="sm:pl-8">
          <StatsCounter
            label="Daily Liquidations Handled"
            seed={STATS_SEED.dailyLiquidations}
            prefix="$"
            nudgeMax={1200}
          />
        </div>
      </Reveal>
    </section>
  );
}
