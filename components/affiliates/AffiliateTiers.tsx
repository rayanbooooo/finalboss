import { AFFILIATE_TIERS } from "@/lib/mockData";
import { TierCard } from "@/components/affiliates/TierCard";

export function AffiliateTiers() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Commission tiers</h2>
          <p className="mt-4 text-white/55">
            The more traders you refer, the higher your commission share climbs.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {AFFILIATE_TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} />
          ))}
        </div>
      </div>
    </section>
  );
}
