import { AFFILIATE_TIERS } from "@/lib/mockData";
import { TierCard } from "@/components/affiliates/TierCard";
import { Reveal } from "@/components/ui/Reveal";

export function AffiliateTiers() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-xl">
          <span className="font-mono text-xs tracking-wide text-emerald-400/70">
            [ COMMISSION TIERS ]
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Climb the ladder
          </h2>
          <p className="mt-4 text-white/50">
            The more traders you refer, the higher your commission share
            climbs.
          </p>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {AFFILIATE_TIERS.map((tier, index) => (
            <Reveal key={tier.id} delay={index * 0.08}>
              <TierCard tier={tier} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
