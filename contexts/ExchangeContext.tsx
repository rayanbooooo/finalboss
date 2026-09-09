"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { getSupabase } from "@/lib/supabase";
import { decryptSecret, encryptSecret } from "@/lib/exchange/crypto";
import { parseKeyPermissions, requests } from "@/lib/exchange/bybit";
import { send, syncClock } from "@/lib/exchange/relay";
import {
  ExchangeError,
  type ExchangeCredentials,
  type KeyPermissions,
} from "@/lib/exchange/types";

/** The secret is cleared after this long without interaction. Memory-only, so
 * closing the tab locks it for free; this covers a tab left open. */
const AUTO_LOCK_MS = 15 * 60 * 1000;

export interface StoredConnection {
  id: string;
  venue: "bybit";
  isTestnet: boolean;
  apiKey: string;
  ciphertext: string;
  salt: string;
  iv: string;
  iterations: number;
}

interface ConnectParams {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
  /** Absent means "don't save" - the secret stays in memory for this session
   * and nothing is written to the database. */
  passphrase?: string;
}

interface ExchangeContextValue {
  /** A credential row exists (saved connection). */
  isConnected: boolean;
  /** The secret is in memory and requests can be signed right now. These are
   * deliberately separate: connected-but-locked is a real, visible state. */
  isUnlocked: boolean;
  connection: StoredConnection | null;
  /** Set for a session-only connection, which has no stored row. */
  sessionOnly: boolean;
  testnet: boolean;
  permissions: KeyPermissions | null;
  ready: boolean;

  connect: (params: ConnectParams) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  disconnect: () => Promise<void>;
  /** Credentials for signing, or null when locked. */
  credentials: () => ExchangeCredentials | null;
}

const ExchangeContext = createContext<ExchangeContextValue | null>(null);

export function ExchangeProvider({ children }: { children: ReactNode }) {
  const { userId } = useOnboarding();
  const [connection, setConnection] = useState<StoredConnection | null>(null);
  const [permissions, setPermissions] = useState<KeyPermissions | null>(null);
  const [sessionOnly, setSessionOnly] = useState(false);
  const [ready, setReady] = useState(false);
  // Never in state: keeping the plaintext secret out of React state keeps it
  // out of devtools' component inspector and any state-serialising tooling.
  const secretRef = useRef<string | null>(null);
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null);

  const isUnlocked = unlockedAt !== null;

  const lock = useCallback(() => {
    secretRef.current = null;
    setUnlockedAt(null);
  }, []);

  // Load any saved connection for this account.
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    if (!supabase || !userId) {
      // Deferred a frame so the effect body itself never calls setState.
      const raf = requestAnimationFrame(() => {
        if (cancelled) return;
        // A session-only connection lives purely in memory and has no row to
        // load, so it must survive this - clearing it unconditionally would
        // disconnect a user who deliberately chose not to save their key.
        setConnection((current) => (current?.id === "session" ? current : null));
        setReady(true);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }

    supabase
      .from("exchange_credentials")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return;
        const row = !error && data?.[0];
        setConnection(
          row
            ? {
                id: row.id,
                venue: row.venue,
                isTestnet: row.is_testnet,
                apiKey: row.api_key,
                ciphertext: row.ciphertext,
                salt: row.salt,
                iv: row.iv,
                iterations: row.iterations,
              }
            : null
        );
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Auto-lock. Any interaction restarts the clock.
  useEffect(() => {
    if (!isUnlocked) return undefined;

    let timer = window.setTimeout(lock, AUTO_LOCK_MS);
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, AUTO_LOCK_MS);
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown"];
    events.forEach((event) => window.addEventListener(event, restart));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, restart));
    };
  }, [isUnlocked, lock]);

  const testnet = connection?.isTestnet ?? true;

  const credentials = useCallback((): ExchangeCredentials | null => {
    if (!connection || !secretRef.current) return null;
    return {
      apiKey: connection.apiKey,
      apiSecret: secretRef.current,
      testnet: connection.isTestnet,
    };
  }, [connection]);

  /**
   * Verifies the key with the venue BEFORE anything is stored, so a key that
   * can withdraw - or one that simply doesn't work - never reaches the
   * database.
   */
  const connect = useCallback(
    async ({ apiKey, apiSecret, testnet: useTestnet, passphrase }: ConnectParams) => {
      const trimmedKey = apiKey.trim();
      const trimmedSecret = apiSecret.trim();
      if (!trimmedKey || !trimmedSecret) {
        throw new ExchangeError("Both the API key and its secret are required.");
      }

      // Signatures are rejected if the timestamp is off, and browser clocks
      // drift, so this has to happen before the first signed call.
      await syncClock(useTestnet);

      const probe: ExchangeCredentials = {
        apiKey: trimmedKey,
        apiSecret: trimmedSecret,
        testnet: useTestnet,
      };
      const result = await send<Record<string, unknown>>(await requests.keyInfo(probe));
      const perms = parseKeyPermissions(result);

      if (perms.canWithdraw) {
        throw new ExchangeError(
          "This key can withdraw funds, so it will not be accepted. Create a new " +
            "key on the exchange with Trade enabled and Withdraw switched off."
        );
      }
      if (perms.expiresAt && perms.expiresAt < Date.now()) {
        throw new ExchangeError("This key has expired. Create a new one on the exchange.");
      }

      secretRef.current = trimmedSecret;
      setPermissions(perms);

      const supabase = getSupabase();
      if (!passphrase || !supabase || !userId) {
        // Session-only: nothing is written anywhere.
        setSessionOnly(true);
        setConnection({
          id: "session",
          venue: "bybit",
          isTestnet: useTestnet,
          apiKey: trimmedKey,
          ciphertext: "",
          salt: "",
          iv: "",
          iterations: 0,
        });
        setUnlockedAt(Date.now());
        return;
      }

      const encrypted = await encryptSecret(trimmedSecret, passphrase);
      const { data, error } = await supabase
        .from("exchange_credentials")
        .upsert(
          {
            user_id: userId,
            venue: "bybit",
            is_testnet: useTestnet,
            api_key: trimmedKey,
            ciphertext: encrypted.ciphertext,
            salt: encrypted.salt,
            iv: encrypted.iv,
            iterations: encrypted.iterations,
            last_used_at: new Date().toISOString(),
          },
          { onConflict: "user_id,venue,is_testnet" }
        )
        .select()
        .single();

      if (error) throw new ExchangeError(`Could not save the connection: ${error.message}`);

      setSessionOnly(false);
      setConnection({
        id: data.id,
        venue: data.venue,
        isTestnet: data.is_testnet,
        apiKey: data.api_key,
        ciphertext: data.ciphertext,
        salt: data.salt,
        iv: data.iv,
        iterations: data.iterations,
      });
      setUnlockedAt(Date.now());
    },
    [userId]
  );

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!connection || !connection.ciphertext) {
        throw new ExchangeError("There is no saved key to unlock.");
      }
      // Throws on a wrong passphrase or tampered ciphertext - AES-GCM's auth
      // tag makes those the same failure, which is what we want.
      const secret = await decryptSecret(
        {
          ciphertext: connection.ciphertext,
          salt: connection.salt,
          iv: connection.iv,
          iterations: connection.iterations,
        },
        passphrase
      );
      await syncClock(connection.isTestnet);
      secretRef.current = secret;
      setUnlockedAt(Date.now());
    },
    [connection]
  );

  const disconnect = useCallback(async () => {
    lock();
    setPermissions(null);
    const supabase = getSupabase();
    if (supabase && userId && connection && !sessionOnly) {
      await supabase.from("exchange_credentials").delete().eq("id", connection.id);
    }
    setSessionOnly(false);
    setConnection(null);
  }, [connection, lock, sessionOnly, userId]);

  const value = useMemo<ExchangeContextValue>(
    () => ({
      isConnected: connection !== null,
      isUnlocked,
      connection,
      sessionOnly,
      testnet,
      permissions,
      ready,
      connect,
      unlock,
      lock,
      disconnect,
      credentials,
    }),
    [
      connection,
      isUnlocked,
      sessionOnly,
      testnet,
      permissions,
      ready,
      connect,
      unlock,
      lock,
      disconnect,
      credentials,
    ]
  );

  return <ExchangeContext.Provider value={value}>{children}</ExchangeContext.Provider>;
}

export function useExchange(): ExchangeContextValue {
  const ctx = useContext(ExchangeContext);
  if (!ctx) throw new Error("useExchange must be used within an ExchangeProvider");
  return ctx;
}
