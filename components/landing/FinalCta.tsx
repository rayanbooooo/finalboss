"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

export function FinalCta() {
  const { isOnboarded } = useOnboarding();
  const href = isOnboarded ? "/terminal" : "/signup";

  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 animate-drift-2 rounded-full bg-gradient-to-br from-violet-500/25 via-sky-400/20 to-emerald-400/20 blur-[110px] motion-reduce:animate-none" />
      </div>

      <Reveal className="relative mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-white/[0.03] px-8 py-16 text-center backdrop-blur-xl sm:px-14">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Your first trade is one click away.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-white/55">
          Connect a wallet or sign up with email, and start trading live
          perpetual markets in under a minute.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={href} className={cn(buttonVariants("primary", "lg"), "w-full sm:w-auto")}>
            {isOnboarded ? "Launch App" : "Create Account"} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/affiliates"
            className={cn(buttonVariants("outline", "lg"), "w-full sm:w-auto")}
          >
            Explore Affiliates
          </Link>
        </div>
        <p className="mt-6 text-[11px] leading-relaxed text-white/30">
          <span className="text-amber-400">&#9888;</span> High leverage
          magnifies losses as fast as gains. Trade responsibly.
        </p>
      </Reveal>
    </section>
  );
}
