"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export interface FundingTransaction {
  id: string;
  kind: "deposit" | "withdrawal";
  asset: string;
  amount: number;
  note?: string;
  createdAt: number;
}

interface FundingRow {
  id: string;
  kind: "deposit" | "withdrawal";
  asset: string;
  amount: number;
  note: string | null;
  created_at: string;
}

const STORAGE_KEY = "finalboss:funding";
/** Every account opens with demo funds - there is no real money here. */
export const STARTING_DEMO_FUNDS = 10_000;
export const DEMO_FUNDS_NOTE = "Starting demo funds";

function rowToTransaction(row: FundingRow): FundingTransaction {
  return {
    id: row.id,
    kind: row.kind,
    asset: row.asset,
    amount: Number(row.amount),
    note: row.note ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/**
 * Deposits and withdrawals of demo funds. Deliberately append-only: the
 * spendable balance is derived from these plus position outcomes (see
 * TerminalContext) rather than stored, so a balance can never drift out of
 * sync with the history that produced it.
 */
export function useFunding(userId: string | null) {
  const [transactions, setTransactions] = useState<FundingTransaction[]>([]);
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const seededRef = useRef<string | null>(null);

  const remote = useMemo(() => {
    const supabase = getSupabase();
    return supabase && userId ? { supabase, userId } : null;
  }, [userId]);

  const storeKey = userId ?? "local";
  const restored = restoredFor === storeKey;

  const record = useCallback(
    (kind: FundingTransaction["kind"], amount: number, note?: string) => {
      const transaction: FundingTransaction = {
        id: crypto.randomUUID(),
        kind,
        asset: "USDC",
        amount,
        note,
        createdAt: Date.now(),
      };
      setTransactions((prev) => [transaction, ...prev]);

      if (remote) {
        void remote.supabase
          .from("funding_transactions")
          .insert({
            id: transaction.id,
            user_id: remote.userId,
            kind,
            asset: transaction.asset,
            amount,
            note: note ?? null,
          })
          .then(({ error }) => {
            if (error) console.error("Could not save funding entry:", error.message);
          });
      }
      return transaction;
    },
    [remote]
  );

  useEffect(() => {
    let cancelled = false;

    if (remote) {
      void remote.supabase
        .from("funding_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.error("Could not load funding history:", error.message);
          } else if (data) {
            setTransactions((data as FundingRow[]).map(rowToTransaction));
          }
          setRestoredFor(storeKey);
        });
      return () => {
        cancelled = true;
      };
    }

    const raf = requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        setTransactions(raw ? (JSON.parse(raw) as FundingTransaction[]) : []);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setRestoredFor(storeKey);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [remote, storeKey]);

  useEffect(() => {
    if (!restored || remote) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch {
      // Storage full or blocked - the session still works from memory.
    }
  }, [transactions, restored, remote]);

  // A brand new account has nothing to trade with until it's funded.
  useEffect(() => {
    if (!restored || transactions.length > 0 || seededRef.current === storeKey) return;
    seededRef.current = storeKey;
    record("deposit", STARTING_DEMO_FUNDS, DEMO_FUNDS_NOTE);
  }, [restored, transactions.length, storeKey, record]);

  const netFunding = useMemo(
    () =>
      transactions.reduce(
        (total, t) => total + (t.kind === "deposit" ? t.amount : -t.amount),
        0
      ),
    [transactions]
  );

  const deposit = useCallback(
    (amount: number) => record("deposit", amount),
    [record]
  );
  const withdraw = useCallback(
    (amount: number) => record("withdrawal", amount),
    [record]
  );

  return { transactions, netFunding, deposit, withdraw };
}
