import type { Feature } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface FeatureCardProps extends Feature {
  index: number;
}

export function FeatureCard({ icon: Icon, title, description, index }: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6",
        "transition-colors duration-300 hover:border-violet-500/30 hover:bg-white/[0.04]"
      )}
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-violet-300 transition-colors group-hover:border-violet-500/30">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="font-mono text-xs text-white/20">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{description}</p>
    </div>
  );
}
