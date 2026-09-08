import { HOW_IT_WORKS_STEPS } from "@/lib/mockData";

export function HowItWorks() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">How it works</h2>
          <p className="mt-4 text-white/55">
            From wallet connect to your first trade in under a minute.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <div key={item.step} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 font-mono text-lg font-bold text-violet-300">
                {item.step}
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
