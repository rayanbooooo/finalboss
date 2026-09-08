"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";

const STORAGE_KEY = "finalboss:onboarded";

interface OnboardingContextValue {
  /** True once a wallet is connected or a signup was completed. */
  isOnboarded: boolean;
  /** True once we've finished checking localStorage and wagmi's reconnect attempt. */
  isResolved: boolean;
  markOnboarded: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isConnected, status } = useAccount();
  const [signedUp, setSignedUp] = useState(false);
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setSignedUp(window.localStorage.getItem(STORAGE_KEY) === "1");
      setLocalReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const markOnboarded = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setSignedUp(true);
  }, []);

  const walletResolved = status !== "connecting" && status !== "reconnecting";

  const value: OnboardingContextValue = {
    isOnboarded: isConnected || signedUp,
    isResolved: localReady && walletResolved,
    markOnboarded,
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}
