import type { Metadata } from "next";
import { EngineShell } from "@/components/engine/EngineShell";

export const metadata: Metadata = {
  title: "MNQ Engine — Indices Terminal",
  description:
    "MNQ setup scanner: liquidity sweeps, fair value gaps and order blocks, scored by confluence and gated by prop-firm drawdown rules.",
};

export default function EnginePage() {
  return <EngineShell />;
}
