"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { useTerminal } from "@/contexts/TerminalContext";
import { OpenPositionsTable } from "@/components/terminal/OpenPositionsTable";
import { OrderHistoryTable } from "@/components/terminal/OrderHistoryTable";

const TABS = [
  { value: "open", label: "Open Positions" },
  { value: "history", label: "Order History" },
];

export function PositionsPanel() {
  const [tab, setTab] = useState("open");
  const { openPositions, history } = useTerminal();

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-6">
        <Tabs items={TABS} value={tab} onChange={setTab} />
        <span className="text-xs text-white/40">
          {tab === "open" ? `${openPositions.length} open` : `${history.length} closed`}
        </span>
      </div>
      <div className="overflow-x-auto">
        {tab === "open" ? <OpenPositionsTable /> : <OrderHistoryTable />}
      </div>
    </div>
  );
}
