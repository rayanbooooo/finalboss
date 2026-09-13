import { Check, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Where the programme actually stands.
 *
 * This exists because the page used to promise a 20-40% fee share, monthly
 * USDC payouts and a dedicated account manager, while the signed-in dashboard
 * said "Commission earned $0.00 - no fees have been charged yet". Both cannot
 * be true. Tracking is real and worth signing up for; the payout is not built,
 * and saying so is cheaper than being found out.
 */
export function ProgramStatus() {
  return (
    <section className="px-4 pb-4 sm:px-6 lg:px-8">
      <Reveal className="mx-auto max-w-3xl">
        <GlassCard className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-white">Where this stands today</h2>
          <ul className="mt-4 flex flex-col gap-4">
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-sm leading-relaxed text-white/70">
                <span className="font-medium text-white">Referral tracking is live.</span>{" "}
                Your code, your link and everyone who signs up through it are recorded
                for real, starting the moment you create an account.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span className="text-sm leading-relaxed text-white/70">
                <span className="font-medium text-white">
                  Commission is not paying out yet.
                </span>{" "}
                FinalBoss charges no trading fees — orders execute on your own account
                at the exchange, and the fees go there. There is no revenue to take a
                share of, so no commission is being earned or owed.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-sm leading-relaxed text-white/70">
                <span className="font-medium text-white">Referrals made now still count.</span>{" "}
                Attribution is permanent, so anyone you bring in today is still yours
                if and when the tiers below become active.
              </span>
            </li>
          </ul>
        </GlassCard>
      </Reveal>
    </section>
  );
}
