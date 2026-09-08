import { Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function AffiliateHero() {
  return (
    <section className="px-4 pb-12 pt-16 text-center sm:px-6 lg:px-8">
      <Badge variant="emerald" className="mx-auto w-fit">
        <Users className="h-3 w-3" /> Referral Program
      </Badge>
      <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
        Earn real yield by growing the ecosystem
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-white/60">
        Share your referral link, and earn a share of the trading fees generated
        by every trader you bring on board — paid automatically, forever.
      </p>
    </section>
  );
}
