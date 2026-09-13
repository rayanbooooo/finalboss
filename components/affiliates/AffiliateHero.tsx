import { Reveal } from "@/components/ui/Reveal";

export function AffiliateHero() {
  return (
    <section className="px-4 pb-12 pt-16 sm:px-6 lg:px-8">
      <Reveal className="mx-auto max-w-3xl text-center">
        <span className="font-mono text-xs tracking-wide text-emerald-400/70">
          [ REFERRAL PROGRAM ]
        </span>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Bring traders in, and keep the credit
        </h1>
        {/* The previous version promised "a share of the trading fees ... paid
            automatically, forever". FinalBoss charges no trading fees, so there
            was nothing behind it. What is true is the tracking. */}
        <p className="mx-auto mt-5 max-w-2xl text-white/55">
          Get a permanent referral link and a dashboard that records everyone who
          signs up through it. Attribution is real and starts today; the
          commission tiers below are the planned structure, not a live payout.
        </p>
      </Reveal>
    </section>
  );
}
