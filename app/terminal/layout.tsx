import type { ReactNode } from "react";
import { TerminalProvider } from "@/contexts/TerminalContext";
import { TerminalGate } from "@/components/terminal/TerminalGate";
import { TerminalSidebar } from "@/components/terminal/TerminalSidebar";
import { FundingModal } from "@/components/terminal/FundingModal";

export default function TerminalRouteLayout({ children }: { children: ReactNode }) {
  return (
    <TerminalGate>
      <TerminalProvider>
        {/* Fixed to the viewport on desktop so panels scroll inside the shell
            rather than the page scrolling as a whole; stacks and scrolls
            normally on small screens. */}
        <div className="flex min-h-screen lg:h-screen lg:overflow-hidden">
          <TerminalSidebar />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
        <FundingModal />
      </TerminalProvider>
    </TerminalGate>
  );
}
