"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";

import { useOnboarding } from "@/contexts/OnboardingContext";
import { useAsterAgent, type AgentStatus } from "@/hooks/useAsterAgent";
import { decryptSecret } from "@/lib/exchange/crypto";
import type { AgentCredentials } from "@/lib/exchange/aster/execute";
import type { StoredAgent } from "@/lib/exchange/aster/session";

/**
 * The approved Aster agent, shared across the terminal.
 *
 * A context rather than a hook per component, because unlocking is shared
 * state: the order form, the positions table and the settings panel all need to
 * know whether the trading key is available, and a hook would give each of them
 * its own copy - so unlocking in one would leave the others still locked, with
 * no way for the user to tell which.
 *
 * The decrypted key lives in a ref, never in state. State is rendered, logged
 * by devtools and captured by error reporters; a ref is none of those. It is
 * handed out only through `credentials()`, at the moment an order is signed.
 */
interface AsterContextValue {
  agent: StoredAgent | null;
  /** An approval exists, is current, and belongs to the connected wallet. */
  approved: boolean;
  /** Approved, and the trading key has been decrypted this session. */
  unlocked: boolean;
  status: AgentStatus;
  error: string | null;
  approve: (passphrase: string) => Promise<void>;
  revoke: () => void;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  /** The credentials needed to sign an order, or null when locked. */
  credentials: () => AgentCredentials | null;
}

const AsterContext = createContext<AsterContextValue | null>(null);

export function AsterProvider({ children }: { children: ReactNode }) {
  const { userId } = useOnboarding();
  const { address } = useAccount();
  const agentState = useAsterAgent(userId);

  const keyRef = useRef<`0x${string}` | null>(null);
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const lock = useCallback(() => {
    keyRef.current = null;
    setUnlockedAt(null);
  }, []);

  const unlock = useCallback(
    async (passphrase: string) => {
      setUnlockError(null);
      const agent = agentState.agent;
      if (!agent) {
        setUnlockError("Approve Aster before unlocking.");
        return;
      }
      try {
        const key = await decryptSecret(agent.key, passphrase);
        keyRef.current = key as `0x${string}`;
        setUnlockedAt(Date.now());
      } catch {
        // Decryption fails the same way for a wrong passphrase and for a
        // corrupted record, and the user can only act on the first, so that is
        // what it says.
        keyRef.current = null;
        setUnlockedAt(null);
        setUnlockError("That passphrase does not unlock this trading key.");
      }
    },
    [agentState.agent]
  );

  const credentials = useCallback((): AgentCredentials | null => {
    const agent = agentState.agent;
    if (!agent || !keyRef.current) return null;

    // The wallet can change under a still-unlocked key. Handing out
    // credentials for an approval that belongs to a different wallet would
    // sign an order against an account the user is no longer looking at.
    if (!address || agent.user.toLowerCase() !== address.toLowerCase()) return null;

    return {
      signer: agent.address,
      privateKey: keyRef.current,
      network: agent.network,
    };
  }, [address, agentState.agent]);

  const value = useMemo<AsterContextValue>(
    () => ({
      agent: agentState.agent,
      approved: agentState.ready,
      unlocked: unlockedAt !== null && agentState.ready,
      status: agentState.status,
      error: unlockError ?? agentState.error,
      approve: agentState.approve,
      revoke: () => {
        lock();
        agentState.revoke();
      },
      unlock,
      lock,
      credentials,
    }),
    [agentState, credentials, lock, unlock, unlockError, unlockedAt]
  );

  return <AsterContext.Provider value={value}>{children}</AsterContext.Provider>;
}

export function useAster(): AsterContextValue {
  const ctx = useContext(AsterContext);
  if (!ctx) {
    throw new Error("useAster must be used within an AsterProvider");
  }
  return ctx;
}
