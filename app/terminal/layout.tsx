import type { ReactNode } from "react";
import { TerminalProvider } from "@/contexts/TerminalContext";
import { TerminalGate } from "@/components/terminal/TerminalGate";
import { TerminalSidebar } from "@/components/terminal/TerminalSidebar";

export default function TerminalRouteLayout({ children }: { children: ReactNode }) {
  return (
    <TerminalGate>
      <TerminalProvider>
        <div className="flex">
          <TerminalSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </TerminalProvider>
    </TerminalGate>
  );
}
