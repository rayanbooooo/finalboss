"use client";

import { Tabs } from "@/components/ui/Tabs";
import { useTerminal, type PositionsTab } from "@/contexts/TerminalContext";
import { OpenPositionsTable } from "@/components/terminal/OpenPositionsTable";
import { OrderHistoryTable } from "@/components/terminal/OrderHistoryTable";

const TABS = [
  { value: "open", label: "Open Positions" },
  { value: "history", label: "Order History" },
];

export function PositionsPanel() {
  const { openPositions, history, positionsTab, setPositionsTab } = useTerminal();

  return (
    <div id="positions-panel" className="flex flex-col scroll-mt-4">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-6">
        <Tabs
          items={TABS}
          value={positionsTab}
          onChange={(value) => setPositionsTab(value as PositionsTab)}
        />
        <span className="text-xs text-white/40">
          {positionsTab === "open" ? `${openPositions.length} open` : `${history.length} closed`}
        </span>
      </div>
      <div className="overflow-x-auto">
        {positionsTab === "open" ? <OpenPositionsTable /> : <OrderHistoryTable />}
      </div>
    </div>
  );
}
