"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { NAV_LINKS } from "@/lib/mockData";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { buttonVariants } from "@/components/ui/Button";
import { AccountControls } from "@/components/wallet/AccountControls";
import { Logo } from "@/components/ui/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { LiveTicker } from "@/components/layout/LiveTicker";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isOnboarded } = useOnboarding();
  // A signed-in account has nothing to sign up for.
  const navLinks = NAV_LINKS.filter((link) => !(isOnboarded && link.href === "/signup"));

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-base-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-white">
          <Logo />
          <span className="text-lg font-bold tracking-tight">FinalBoss</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
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
          {/* Without this there is no way into an existing account from the
              landing page: Sign Up, Connect Wallet and Start Trading all lead
              somewhere else. */}
          {!isOnboarded && (
            <Link
              href="/signin"
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Sign In
            </Link>
          )}
          <AccountControls size="md" />
          <Link
            href={isOnboarded ? "/terminal" : "/signup"}
            className={cn(buttonVariants("primary", "md"))}
          >
            {isOnboarded ? "Launch App" : "Start Trading"}
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
