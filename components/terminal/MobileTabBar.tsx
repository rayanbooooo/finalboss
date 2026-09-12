"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CandlestickChart, LifeBuoy, ListOrdered, Settings, Wallet } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { startGuidedTour } from "@/components/terminal/GuidedTour";
import { cn } from "@/lib/utils";

/**
 * Terminal navigation for phones and tablets.
 *
 * The sidebar is `hidden lg:flex`, so below 1024px there was no way to reach
 * positions, funding, the guide or settings at all - most of the app was
 * simply unreachable on a phone. Desktop keeps the sidebar and never sees
 * this.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { positionsTab, setPositionsTab, openFunding } = useTerminal();
  const onTradeScreen = pathname === "/terminal";

  const showPositions = (tab: "open" | "history") => {
    setPositionsTab(tab);
    if (!onTradeScreen) {
      router.push("/terminal");
      return;
    }
    document
      .getElementById("positions-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="Terminal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-base-950 lg:hidden",
        // Clears the home indicator on phones that have one.
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div className="grid grid-cols-5">
        <Tab
          icon={CandlestickChart}
          label="Trade"
          active={onTradeScreen}
          href="/terminal"
        />
        <Tab
          icon={ListOrdered}
          label="Positions"
          active={onTradeScreen && positionsTab === "open"}
          onClick={() => showPositions("open")}
        />
        <Tab icon={Wallet} label="Funds" onClick={() => openFunding("deposit")} />
        <Tab icon={LifeBuoy} label="Guide" onClick={() => {
          startGuidedTour();
          if (!onTradeScreen) router.push("/terminal");
        }} />
        <Tab
          icon={Settings}
          label="Settings"
          active={pathname === "/terminal/settings"}
          href="/terminal/settings"
        />
      </div>
    </nav>
  );
}

function Tab({
  icon: Icon,
  label,
  active,
  href,
  onClick,
}: {
  icon: typeof CandlestickChart;
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  // 56px tall: comfortably past the ~44px a thumb needs.
  const className = cn(
    "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
    active ? "text-violet-300" : "text-white/45"
  );
  const inner = (
    <>
      <Icon className="h-5 w-5" />
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
