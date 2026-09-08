import type { ReactNode } from "react";
import { TerminalProvider } from "@/contexts/TerminalContext";

export default function TerminalRouteLayout({ children }: { children: ReactNode }) {
  return <TerminalProvider>{children}</TerminalProvider>;
}
