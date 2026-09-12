"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useTerminal } from "@/contexts/TerminalContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { formatCompactNumber, formatPercent, formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { ConnectedBadge } from "@/components/wallet/ConnectedBadge";
import { AccountModeSwitch } from "@/components/terminal/AccountModeSwitch";
import { AccountBadge } from "@/components/wallet/AccountBadge";
import { MarketSelector } from "@/components/terminal/MarketSelector";
import { cn } from "@/lib/utils";

export function MarketHeader() {
  const { market } = useTerminal();
  const { isConnected } = useAccount();
  const { profile } = useOnboarding();
  const { open: openWalletModal } = useWalletModal();
  const positive = market.change24hPct >= 0;

  const accountControl = isConnected ? (
    <ConnectedBadge />
  ) : profile ? (
    <AccountBadge />
  ) : (
    <Button variant="outline" size="md" onClick={openWalletModal}>
      Connect Wallet
    </Button>
  );

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
      <div className="flex w-full items-center gap-2 lg:w-auto">
        <span className="hidden text-[11px] uppercase tracking-wider text-white/35 sm:block">
          Account
        </span>
        <AccountModeSwitch />
        <div className="flex items-center gap-3 lg:hidden">{accountControl}</div>
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

      <div className="ml-auto hidden items-center gap-3 lg:flex">{accountControl}</div>
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
