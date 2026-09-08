import { HOW_IT_WORKS_STEPS } from "@/lib/mockData";
import { Reveal } from "@/components/ui/Reveal";

export function HowItWorks() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-xl">
          <span className="font-mono text-xs tracking-wide text-violet-400/70">
            [ ONBOARDING ]
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-white/50">
            From wallet connect to your first trade in under a minute.
          </p>
        </Reveal>

        <div className="relative mt-14 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent lg:block"
            aria-hidden="true"
          />
          {HOW_IT_WORKS_STEPS.map((item, index) => (
            <Reveal key={item.step} delay={index * 0.08} className="relative">
              <span className="relative z-10 inline-block bg-base-950 pr-3 font-mono text-2xl font-semibold text-white/25">
                {String(item.step).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {item.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
