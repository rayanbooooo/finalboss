"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, TrendingUp } from "lucide-react";
import { useAccount } from "wagmi";
import { NAV_LINKS } from "@/lib/mockData";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ConnectedBadge } from "@/components/wallet/ConnectedBadge";
import { MobileNav } from "@/components/layout/MobileNav";
import { LiveTicker } from "@/components/layout/LiveTicker";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isConnected } = useAccount();
  const { open: openWalletModal } = useWalletModal();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-base-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-emerald-500 shadow-glow-violet">
            <TrendingUp className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight">FinalBoss</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <LiveTicker />

        <div className="hidden items-center gap-3 md:flex">
          {isConnected ? (
            <ConnectedBadge />
          ) : (
            <Button variant="outline" size="md" onClick={openWalletModal}>
              Connect Wallet
            </Button>
          )}
          <Link href="/terminal" className={cn(buttonVariants("primary", "md"))}>
            Start Trading
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-white md:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <MobileNav isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
