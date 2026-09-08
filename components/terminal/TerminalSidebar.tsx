"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CandlestickChart,
  History,
  Home,
  ListOrdered,
  Wallet,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useTerminal } from "@/contexts/TerminalContext";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

function scrollToPositions() {
  document.getElementById("positions-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * FrontDEX-style icon rail, scoped to the /terminal app shell only (the
 * marketing site keeps its own top Navbar). Every icon goes somewhere real -
 * an icon without a destination would misrepresent what the app can do.
 */
export function TerminalSidebar() {
  const { isConnected } = useAccount();
  const { open: openWalletModal } = useWalletModal();
  const { positionsTab, setPositionsTab, fundingMode, openFunding } = useTerminal();
  const pathname = usePathname();
  const router = useRouter();
  const onTradeScreen = pathname === "/terminal";

  // The positions panel only exists on the trade screen, so from any other
  // route these have to navigate back to it or the click does nothing.
  const showPositions = (tab: "open" | "history") => {
    setPositionsTab(tab);
    if (onTradeScreen) scrollToPositions();
    else router.push("/terminal");
  };

  return (
    <div className="hidden w-16 shrink-0 flex-col items-center border-r border-white/5 bg-base-900/60 py-4 lg:flex">
      <Link href="/" aria-label="FinalBoss home">
        <Logo className="h-9 w-9" />
      </Link>

      <div className="mt-8 flex flex-col items-center gap-1">
        <SidebarButton icon={CandlestickChart} label="Trade" active={onTradeScreen} href="/terminal" />
        <SidebarButton
          icon={ListOrdered}
          label="Open positions"
          active={onTradeScreen && positionsTab === "open"}
          onClick={() => showPositions("open")}
        />
        <SidebarButton
          icon={History}
          label="Order history"
          active={onTradeScreen && positionsTab === "history"}
          onClick={() => showPositions("history")}
        />
        <SidebarButton
          icon={ArrowDownToLine}
          label="Deposit"
          active={fundingMode === "deposit"}
          onClick={() => openFunding("deposit")}
        />
        <SidebarButton
          icon={ArrowUpFromLine}
          label="Withdraw"
          active={fundingMode === "withdraw"}
          onClick={() => openFunding("withdraw")}
        />
      </div>

      <div className="mt-auto flex flex-col items-center gap-1">
        <SidebarButton
          icon={Wallet}
          label={isConnected ? "Wallet" : "Connect wallet"}
          dot={isConnected}
          onClick={openWalletModal}
        />
        <SidebarButton icon={Home} label="Back to site" href="/" />
      </div>
    </div>
  );
}

interface SidebarButtonProps {
  icon: typeof CandlestickChart;
  label: string;
  /** Marks the current section. Deliberately a quiet tint, not a filled
   * button - a solid accent reads as "press me" and makes an already-active
   * item feel broken when clicking it does nothing. */
  active?: boolean;
  /** A status dot, for state that isn't "you are here" (a live connection). */
  dot?: boolean;
  onClick?: () => void;
  href?: string;
}

function SidebarButton({ icon: Icon, label, active, dot, onClick, href }: SidebarButtonProps) {
  const className = cn(
    "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
    active
      ? "bg-violet-500/15 text-violet-300"
      : "text-white/40 hover:bg-white/5 hover:text-white/80"
  );

  const content = (
    <>
      <Icon className="h-[18px] w-[18px]" />
      {active && (
        <span className="absolute -left-2 h-5 w-0.5 rounded-full bg-violet-400" aria-hidden="true" />
      )}
      {dot && (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
      )}
    </>
  );

  // title gives the icon rail a hover tooltip - without labels there's
  // otherwise no way to tell what any of these do.
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {content}
    </button>
  );
}
