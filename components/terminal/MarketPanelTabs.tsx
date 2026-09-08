"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { OrderBook } from "@/components/terminal/OrderBook";
import { TradeHistoryTape } from "@/components/terminal/TradeHistoryTape";

const TABS = [
  { value: "orderbook", label: "Order Book" },
  { value: "trades", label: "Trades" },
];

export function MarketPanelTabs() {
  const [tab, setTab] = useState("orderbook");

  return (
    <div>
      <div className="px-3 pt-3">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </div>
      <div className="mt-2">{tab === "orderbook" ? <OrderBook /> : <TradeHistoryTape />}</div>
    </div>
  );
}
