import { FEATURES } from "@/lib/mockData";
import { FeatureCard } from "@/components/landing/FeatureCard";
import { Reveal } from "@/components/ui/Reveal";

export function FeaturesGrid() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
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
