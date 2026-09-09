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

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-3 border-b border-white/5 px-4 py-4 sm:px-6">
      {/* The sidebar carries the mark on desktop; on mobile this is the only
          way back out of the terminal. */}
      <Link href="/" aria-label="FinalBoss home" className="lg:hidden">
        <Logo className="h-9 w-9" />
      </Link>

      <MarketSelector />

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-mono text-2xl font-bold",
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

      <div className="flex items-center gap-2">
        <span className="hidden text-[11px] uppercase tracking-wider text-white/35 sm:block">
          Account
        </span>
        <AccountModeSwitch />
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

      <div className="ml-auto flex items-center gap-3">
        {isConnected ? (
          <ConnectedBadge />
        ) : profile ? (
          <AccountBadge />
        ) : (
          <Button variant="outline" size="md" onClick={openWalletModal}>
            Connect Wallet
          </Button>
        )}
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
