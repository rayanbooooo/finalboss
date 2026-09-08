import { Eye, Lock, Radio, Zap } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

const PILLARS = [
  {
    icon: Lock,
    title: "Non-custodial by design",
    description:
      "Connect a wallet or sign up with email — FinalBoss never takes custody of your funds during onboarding.",
  },
  {
    icon: Eye,
    title: "Transparent liquidation math",
    description:
      "Every position's entry and liquidation price are drawn directly on the live chart the instant it fills — no black-box margin calls.",
  },
  {
    icon: Radio,
    title: "Honestly labeled data",
    description:
      "A LIVE or SIMULATED badge tells you exactly which feed is pricing the market you're looking at, always.",
  },
  {
    icon: Zap,
    title: "Off-chain matching, instant fills",
    description:
      "Orders match off-chain for millisecond execution, with zero gas fees on every trade.",
  },
];

export function SecuritySection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/3 -top-24 h-[460px] w-[460px] animate-drift-1 rounded-full bg-sky-400/10 blur-[110px] motion-reduce:animate-none" />
        <div className="absolute -right-24 bottom-0 h-[360px] w-[360px] animate-drift-3 rounded-full bg-emerald-400/10 blur-[100px] motion-reduce:animate-none" />
      </div>

      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-xl">
          <span className="font-mono text-xs tracking-wide text-violet-400/70">[ TRUST ]</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Built for traders who verify, not trust
          </h2>
          <p className="mt-4 text-white/50">
            No black boxes — the same math and data you see is what drives
            every fill.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar, index) => (
            <Reveal
              key={pillar.title}
              delay={index * 0.06}
              className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-emerald-300">
                <pillar.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">{pillar.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">
                  {pillar.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
