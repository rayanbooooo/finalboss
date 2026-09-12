"use client";

import Link from "next/link";
import { useTerminal } from "@/contexts/TerminalContext";
import { formatCompactNumber, formatPercent, formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Logo } from "@/components/ui/Logo";
import { AccountModeSwitch } from "@/components/terminal/AccountModeSwitch";
import { AccountControls } from "@/components/wallet/AccountControls";
import { MarketSelector } from "@/components/terminal/MarketSelector";
import { cn } from "@/lib/utils";

export function MarketHeader() {
  const { market } = useTerminal();
  const positive = market.change24hPct >= 0;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/5 px-3 py-2.5 lg:gap-x-8 lg:gap-y-3 lg:px-6 lg:py-4">
      {/* The sidebar carries the mark on desktop; on mobile this is the only
          way back out of the terminal. */}
      <Link
        href="/"
        aria-label="FinalBoss home"
        className="flex h-11 w-11 shrink-0 items-center justify-center lg:hidden"
      >
        <Logo className="h-8 w-8" />
      </Link>

      <MarketSelector />

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-mono text-lg font-bold lg:text-2xl",
            positive ? "text-emerald-400" : "text-rose-400"
          )}
        >
          {formatPrice(market.price)}
        </span>
        <Badge variant={market.isLive ? "emerald" : "violet"}>
          <span
            className={cn(
              "h-1.5 w-1.5 animate-pulse-glow rounded-full",
              market.isLive ? "bg-emerald-400" : "bg-violet-400"
            )}
          />
          {/* "LIVE" here is about the price feed, never about the money -
              hence the explicit wording, and the separately labelled account
              switch beside it. */}
          {market.isLive ? "LIVE PRICES" : "SIMULATED PRICES"}
        </Badge>
      </div>

      <div className="hidden h-8 w-px bg-white/10 sm:block" aria-hidden="true" />

      {/* On mobile the mode switch and the account badge share one row: the
          switch takes the space left over, rather than claiming a full row and
          leaving the badge stranded on another. */}
      <div className="flex w-full items-start gap-2 lg:w-auto">
        <span className="mt-2 hidden text-[11px] uppercase tracking-wider text-white/35 sm:block">
          Account
        </span>
        <AccountModeSwitch />
        <div className="flex items-center gap-3 lg:hidden">
          <AccountControls size="md" />
        </div>
      </div>

      <div className="hidden h-8 w-px bg-white/10 sm:block" aria-hidden="true" />

      <div className="hidden gap-8 text-sm sm:flex">
        <Stat
          label="24h Change"
          value={formatPercent(market.change24hPct)}
          valueClassName={positive ? "text-emerald-400" : "text-rose-400"}
        />
        <Stat label="24h High" value={formatPrice(market.high24h)} />
        <Stat label="24h Low" value={formatPrice(market.low24h)} />
        <Stat label="24h Volume" value={`$${formatCompactNumber(market.volume24h)}`} />
      </div>

      <div className="ml-auto hidden items-center gap-3 lg:flex">
        <AccountControls size="md" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="text-white/40">{label}</div>
      <div className={cn("mt-0.5 font-mono text-white/80", valueClassName)}>{value}</div>
    </div>
  );
}
