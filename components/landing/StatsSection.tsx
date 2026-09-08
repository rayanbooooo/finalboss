import { StatsCounter } from "@/components/landing/StatsCounter";
import { STATS_SEED } from "@/lib/mockData";
import { Reveal } from "@/components/ui/Reveal";

export function StatsSection() {
  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[380px] w-[640px] -translate-x-1/2 -translate-y-1/2 animate-drift-1 rounded-full bg-violet-500/10 blur-[110px] motion-reduce:animate-none" />
      </div>
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
