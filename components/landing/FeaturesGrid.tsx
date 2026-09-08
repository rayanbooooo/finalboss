import { FEATURES } from "@/lib/mockData";
import { FeatureCard } from "@/components/landing/FeatureCard";
import { Reveal } from "@/components/ui/Reveal";

export function FeaturesGrid() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -right-32 top-0 h-[440px] w-[440px] animate-drift-2 rounded-full bg-sky-400/10 blur-[100px] motion-reduce:animate-none" />
        <div className="absolute -left-20 bottom-0 h-[380px] w-[380px] animate-drift-3 rounded-full bg-violet-500/10 blur-[100px] motion-reduce:animate-none" />
      </div>
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-xl">
          <span className="font-mono text-xs tracking-wide text-violet-400/70">
            [ THE STACK ]
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Built for high-leverage traders
          </h2>
          <p className="mt-4 text-white/50">
            Every part of the stack is designed around speed, depth, and risk
            control.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.06}>
              <FeatureCard {...feature} index={index} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
