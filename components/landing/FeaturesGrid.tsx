import { FEATURES } from "@/lib/mockData";
import { FeatureCard } from "@/components/landing/FeatureCard";

export function FeaturesGrid() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Built for high-leverage traders
          </h2>
          <p className="mt-4 text-white/55">
            Every part of the stack is designed around speed, depth, and risk control.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
