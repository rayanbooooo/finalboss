"use client";

import Link from "next/link";
import { CandlestickChart, History, Home, ListOrdered, Wallet } from "lucide-react";
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
 * marketing site keeps its own top Navbar). Every icon maps to something
 * that actually exists on this page - no Deposit/Withdraw/Settings entries,
 * since those pages don't exist yet and a dead icon would be a lie.
 */
export function TerminalSidebar() {
  const { isConnected } = useAccount();
  const { open: openWalletModal } = useWalletModal();
  const { positionsTab, setPositionsTab } = useTerminal();

  return (
    <div className="hidden w-16 shrink-0 flex-col items-center border-r border-white/5 bg-base-900/60 py-4 lg:flex">
      <Link href="/" aria-label="FinalBoss home">
        <Logo className="h-9 w-9" />
      </Link>

      <div className="mt-8 flex flex-col items-center gap-1">
        <SidebarButton icon={CandlestickChart} label="Trade" active />
        <SidebarButton
          icon={ListOrdered}
          label="Open positions"
          active={positionsTab === "open"}
          onClick={() => {
            setPositionsTab("open");
            scrollToPositions();
          }}
        />
        <SidebarButton
          icon={History}
          label="Order history"
          active={positionsTab === "history"}
          onClick={() => {
            setPositionsTab("history");
            scrollToPositions();
          }}
        />
      </div>

      <div className="mt-auto flex flex-col items-center gap-1">
        <SidebarButton
          icon={Wallet}
          label={isConnected ? "Wallet connected" : "Connect wallet"}
          active={isConnected}
          onClick={() => {
            if (!isConnected) openWalletModal();
          }}
        />
        <SidebarButton icon={Home} label="Back to site" href="/" />
      </div>
    </div>
  );
}

interface SidebarButtonProps {
  icon: typeof CandlestickChart;
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}

function SidebarButton({ icon: Icon, label, active, onClick, href }: SidebarButtonProps) {
  const className = cn(
    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
    active ? "bg-violet-600 text-white" : "text-white/40 hover:bg-white/5 hover:text-white/80"
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} className={className}>
        <Icon className="h-[18px] w-[18px]" />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
