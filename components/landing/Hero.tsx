import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-radial-glow px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl text-center">
        <Badge variant="violet" className="mx-auto w-fit">
          <Zap className="h-3 w-3" /> Zero Gas · Instant Settlement
        </Badge>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
          Trade Perpetuals with up to{" "}
          <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
            1000x Leverage
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-white/60 sm:text-lg">
          Gasless execution powered by off-chain matching infrastructure inspired by
          Orderly Network and Aark. Deep orderbook liquidity, instant settlement, and
          zero compromises for the highest-conviction traders.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/terminal"
            className={cn(buttonVariants("primary", "lg"), "w-full sm:w-auto")}
          >
            Launch App <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants("outline", "lg"), "w-full sm:w-auto")}
          >
            Sign Up
          </Link>
        </div>
      </div>
    </section>
  );
}
