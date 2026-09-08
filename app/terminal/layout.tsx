import type { ReactNode } from "react";
import { TerminalProvider } from "@/contexts/TerminalContext";
import { TerminalGate } from "@/components/terminal/TerminalGate";

export default function TerminalRouteLayout({ children }: { children: ReactNode }) {
  return (
    <TerminalGate>
      <TerminalProvider>{children}</TerminalProvider>
    </TerminalGate>
  );
}
