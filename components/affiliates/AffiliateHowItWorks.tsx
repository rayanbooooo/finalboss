import { Reveal } from "@/components/ui/Reveal";

/**
 * What the referral programme actually does, for someone who has not signed in.
 *
 * Every step here is true of the code as it stands: a code is generated once
 * and stored on the profile, `/r/<code>` stores it through the sign-up
 * round-trip, and `attribute_referral` records it exactly once per referred
 * account. Nothing on this page promises a payment.
 */
const STEPS = [
  {
    step: 1,
    title: "Create an account",
    description:
      "A referral link points at an account, so it only exists once you have one. Takes under a minute.",
  },
  {
    step: 2,
    title: "Copy your link",
    description:
      "You get a permanent 8-character code and a link to share. It never changes, so anything you post keeps working.",
  },
  {
    step: 3,
    title: "Referrals are recorded",
    description:
      "Anyone who signs up through your link is attributed to you once, permanently, and appears on your dashboard. You never see their identity.",
  },
];

export function AffiliateHowItWorks() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Reveal className="max-w-xl">
          <span className="font-mono text-xs tracking-wide text-violet-400/70">
            [ HOW IT WORKS ]
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Three steps
          </h2>
        </Reveal>

        <div className="relative mt-12 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-3">
          <div
            className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent sm:block"
            aria-hidden="true"
          />
          {STEPS.map((item, index) => (
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
