"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CandlestickChart,
  History,
  Home,
  LifeBuoy,
  ListOrdered,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Wallet,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useTerminal } from "@/contexts/TerminalContext";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { Logo } from "@/components/ui/Logo";
import { startGuidedTour } from "@/components/terminal/GuidedTour";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "finalboss:sidebar-collapsed";

function scrollToPositions() {
  document.getElementById("positions-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * The terminal's own navigation - the marketing site keeps its top Navbar.
 * Collapses to an icon rail; every entry goes somewhere real, since an icon
 * without a destination would misrepresent what the app can do.
 */
export function TerminalSidebar() {
  const { isConnected } = useAccount();
  const { open: openWalletModal } = useWalletModal();
  const { positionsTab, setPositionsTab, fundingMode, openFunding } = useTerminal();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);

  // Read after paint so the server-rendered markup and hydration agree.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) !== "false");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Preference just won't stick; the sidebar still works.
      }
      return next;
    });
  };

  const onTradeScreen = pathname === "/terminal";

  // The positions panel only exists on the trade screen, so from any other
  // route these have to navigate back to it or the click does nothing.
  const showPositions = (tab: "open" | "history") => {
    setPositionsTab(tab);
    if (onTradeScreen) scrollToPositions();
    else router.push("/terminal");
  };

  return (
    <div
      className={cn(
        "hidden shrink-0 flex-col border-r border-white/5 bg-base-900/60 py-4 transition-[width] duration-200 lg:flex",
        collapsed ? "w-16 items-center" : "w-56 px-3"
      )}
    >
      <Link
        href="/"
        aria-label="FinalBoss home"
        className={cn("flex items-center gap-2", collapsed ? "" : "px-2")}
      >
        <Logo className="h-9 w-9" />
        {!collapsed && <span className="font-bold tracking-tight text-white">FinalBoss</span>}
      </Link>

      <div className="mt-8 flex w-full flex-col items-center gap-1">
        <SidebarItem
          icon={CandlestickChart}
          label="Trade"
          collapsed={collapsed}
          active={onTradeScreen}
          href="/terminal"
        />
        <SidebarItem
          icon={ListOrdered}
          label="Positions"
          collapsed={collapsed}
          active={onTradeScreen && positionsTab === "open"}
          onClick={() => showPositions("open")}
        />
        <SidebarItem
          icon={History}
          label="History"
          collapsed={collapsed}
          active={onTradeScreen && positionsTab === "history"}
          onClick={() => showPositions("history")}
        />
        <SidebarItem
          icon={ArrowDownToLine}
          label="Deposit"
          collapsed={collapsed}
          active={fundingMode === "deposit"}
          onClick={() => openFunding("deposit")}
        />
        <SidebarItem
          icon={ArrowUpFromLine}
          label="Withdraw"
          collapsed={collapsed}
          active={fundingMode === "withdraw"}
          onClick={() => openFunding("withdraw")}
        />
        <SidebarItem
          icon={LifeBuoy}
          label="Guide"
          collapsed={collapsed}
          onClick={() => {
            // The tour only mounts on the trading screen, so get there first;
            // startGuidedTour leaves a request that survives the navigation.
            startGuidedTour();
            if (!onTradeScreen) router.push("/terminal");
          }}
        />
        <SidebarItem
          icon={Settings}
          label="Settings"
          collapsed={collapsed}
          active={pathname === "/terminal/settings"}
          href="/terminal/settings"
        />
      </div>

      <div className="mt-auto flex w-full flex-col items-center gap-1">
        <SidebarItem
          icon={Wallet}
          label={isConnected ? "Wallet" : "Connect wallet"}
          collapsed={collapsed}
          dot={isConnected}
          onClick={openWalletModal}
        />
        <SidebarItem icon={Home} label="Back to site" collapsed={collapsed} href="/" />
        <SidebarItem
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          collapsed={collapsed}
          onClick={toggleCollapsed}
        />
      </div>
    </div>
  );
}

interface SidebarItemProps {
  icon: typeof CandlestickChart;
  label: string;
  collapsed: boolean;
  /** Marks the current section. Deliberately a quiet tint, not a filled
   * button - a solid accent reads as "press me" and makes an already-active
   * item feel broken when clicking it does nothing. */
  active?: boolean;
  /** A status dot, for state that isn't "you are here" (a live connection). */
  dot?: boolean;
  onClick?: () => void;
  href?: string;
}

function SidebarItem({
  icon: Icon,
  label,
  collapsed,
  active,
  dot,
  onClick,
  href,
}: SidebarItemProps) {
  const className = cn(
    "relative flex items-center rounded-lg transition-colors",
    collapsed ? "h-10 w-10 justify-center" : "h-10 w-full gap-3 px-3",
    active
      ? "bg-violet-500/15 text-violet-300"
      : "text-white/40 hover:bg-white/5 hover:text-white/80"
  );

  const content = (
    <>
      <span className="relative flex shrink-0 items-center justify-center">
        <Icon className="h-[18px] w-[18px]" />
        {dot && (
          <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
        )}
      </span>
      {!collapsed && <span className="truncate text-sm font-medium">{label}</span>}
      {active && (
        <span
          className={cn("absolute h-5 w-0.5 rounded-full bg-violet-400", collapsed ? "-left-2" : "-left-1")}
          aria-hidden="true"
        />
      )}
    </>
  );

  // title gives the collapsed rail a hover tooltip - without labels there's
  // otherwise no way to tell what any of the icons do.
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
