import { Check } from "lucide-react";
import type { AffiliateTier } from "@/types/affiliate";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function TierCard({ tier }: { tier: AffiliateTier }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-6 transition-colors duration-300",
        tier.recommended
          ? "border-violet-500/40 bg-violet-500/[0.04] shadow-glow-violet"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
      )}
    >
      {tier.recommended && (
        <Badge variant="violet" className="mb-4 w-fit">
          Most Popular
        </Badge>
      )}
      <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
      <p className="mt-1 text-sm text-white/50">{tier.requirement}</p>
      <div className="mt-4 font-mono text-4xl font-semibold text-emerald-400">
        {tier.commissionPct}%
        <span className="ml-1.5 text-sm font-normal text-white/40">commission</span>
      </div>
      <ul className="mt-6 flex flex-col gap-3">
        {tier.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2 text-sm text-white/70">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            {perk}
          </li>
        ))}
      </ul>
    </div>
  );
}
