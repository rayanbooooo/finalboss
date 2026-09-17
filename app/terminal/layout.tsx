import type { ReactNode } from "react";
import { TerminalProvider } from "@/contexts/TerminalContext";
import { ExchangeProvider } from "@/contexts/ExchangeContext";
import { AsterProvider } from "@/contexts/AsterContext";
import { TerminalBoundary } from "@/components/terminal/TerminalBoundary";
import { TerminalSidebar } from "@/components/terminal/TerminalSidebar";
import { MobileTabBar } from "@/components/terminal/MobileTabBar";
import { ExchangeModals } from "@/components/terminal/ExchangeModals";

export default function TerminalRouteLayout({ children }: { children: ReactNode }) {
  return (
    <TerminalBoundary>
      {/* Outside TerminalProvider: the terminal will read live balances and
          positions from the exchange connection, so the connection has to
          exist first. */}
      <ExchangeProvider>
        {/* Outside TerminalProvider for the same reason: an approved Aster
            agent is what lets the terminal place an order, so it has to exist
            before anything that might want to. */}
        <AsterProvider>
        <TerminalProvider>
          {/* Fixed to the viewport on desktop so panels scroll inside the shell
              rather than the page scrolling as a whole; stacks and scrolls
              normally on small screens. */}
          {/* pb-16 on mobile keeps the last panel clear of the tab bar. */}
          <div className="flex min-h-screen pb-16 lg:h-screen lg:overflow-hidden lg:pb-0">
            <TerminalSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              {children}
              {/* Below the terminal rather than above it: it appears after a
                  position closes, and pushing the chart down at that moment
                  would move the thing they are looking at. */}
            </div>
          </div>
          <MobileTabBar />
          <ExchangeModals />
        </TerminalProvider>
        </AsterProvider>
      </ExchangeProvider>
    </TerminalBoundary>
  );
}
