import type { Feature } from "@/lib/mockData";
import { GlassCard } from "@/components/ui/GlassCard";

export function FeatureCard({ icon: Icon, title, description }: Feature) {
  return (
    <GlassCard className="p-6 transition-transform duration-200 hover:-translate-y-1">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{description}</p>
    </GlassCard>
  );
}
