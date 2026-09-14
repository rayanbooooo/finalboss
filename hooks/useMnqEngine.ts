"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MnqBars } from "@/lib/mnq/feed";
import {
  DEFAULT_SCAN_OPTIONS,
  scanSetups,
  summarise,
  type ScanOptions,
  type ScanResult,
  type Setup,
  type SetupStats,
} from "@/lib/mnq/setups";
import {
  assessAccount,
  emptyAccount,
  gateSetup,
  RULE_PRESETS,
  type AccountAssessment,
  type AccountState,
  type PropRules,
  type SetupGate,
} from "@/lib/mnq/propRules";

/**
 * The dashboard's single source of truth.
 *
 * Bars are fetched from the server (so the Databento key stays there) and
 * everything downstream — structure, zones, setups, sizing — is recomputed on
 * the client. That split is deliberate: scanning is pure and cheap, so moving
 * a scan slider re-renders instantly instead of waiting on a round trip, while
 * the thing that actually needs a secret stays behind the API.
 */

export interface GatedSetup extends Setup {
  /** What the prop rules permit for this setup, at this account state. */
  gate: SetupGate;
}

export interface MnqEngine {
  bars: MnqBars | undefined;
  isLoading: boolean;
  isError: boolean;
  scan: ScanResult | null;
  setups: GatedSetup[];
  stats: SetupStats;
  assessment: AccountAssessment;
  lastPrice: number | null;
  rules: PropRules;
  setRules: (rules: PropRules) => void;
  account: AccountState;
  setAccount: (account: AccountState) => void;
  options: ScanOptions;
  setOptions: (patch: Partial<ScanOptions>) => void;
  intervalMs: number;
  setIntervalMs: (ms: number) => void;
  resetAccount: () => void;
}

const BAR_LIMIT = 1200;
/** Refresh cadence. One minute matches the fastest bar we request. */
const REFETCH_MS = 60_000;

async function fetchBars(intervalMs: number): Promise<MnqBars> {
  const response = await fetch(`/api/mnq/bars?intervalMs=${intervalMs}&limit=${BAR_LIMIT}`);
  if (!response.ok) throw new Error(`Bars request failed: ${response.status}`);
  return (await response.json()) as MnqBars;
}

export function useMnqEngine(): MnqEngine {
  const [intervalMs, setIntervalMs] = useState(60_000);
  const [rules, setRules] = useState<PropRules>(RULE_PRESETS[0]);
  const [account, setAccount] = useState<AccountState>(() => emptyAccount(RULE_PRESETS[0]));
  const [options, setOptionsState] = useState<ScanOptions>(DEFAULT_SCAN_OPTIONS);

  const query = useQuery({
    queryKey: ["mnq-bars", intervalMs],
    queryFn: () => fetchBars(intervalMs),
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS / 2,
  });

  const candles = query.data?.candles;

  // The expensive step, and the reason this is memoised on the bar array
  // identity rather than on the query object: react-query hands back the same
  // array between refetches that changed nothing.
  const scan = useMemo(() => (candles && candles.length > 0 ? scanSetups(candles, options) : null), [candles, options]);

  const assessment = useMemo(() => assessAccount(account, rules), [account, rules]);

  const setups = useMemo<GatedSetup[]>(() => {
    if (!scan) return [];
    return scan.setups
      .map((setup) => ({
        ...setup,
        gate: gateSetup(
          { stopPoints: setup.stopPoints, targetPoints: setup.targetPoints, timestampMs: setup.time },
          account,
          rules,
        ),
      }))
      // Newest first: a scanner is read from the top.
      .sort((a, b) => b.time - a.time);
  }, [scan, account, rules]);

  const stats = useMemo(() => summarise(scan?.setups ?? []), [scan]);

  const setOptions = useCallback((patch: Partial<ScanOptions>) => {
    setOptionsState((current) => ({ ...current, ...patch }));
  }, []);

  const resetAccount = useCallback(() => setAccount(emptyAccount(rules)), [rules]);

  // Changing rules must reset the account, because peak equity and the
  // drawdown floor are only meaningful relative to the ruleset that produced
  // them. Carrying a 50K intraday peak into a static-drawdown preset would
  // report a floor that never existed.
  const applyRules = useCallback((next: PropRules) => {
    setRules(next);
    setAccount(emptyAccount(next));
  }, []);

  return {
    bars: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    scan,
    setups,
    stats,
    assessment,
    lastPrice: candles && candles.length > 0 ? candles[candles.length - 1].close : null,
    rules,
    setRules: applyRules,
    account,
    setAccount,
    options,
    setOptions,
    intervalMs,
    setIntervalMs,
    resetAccount,
  };
}
