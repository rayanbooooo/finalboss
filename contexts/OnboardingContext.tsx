"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAccount, useDisconnect } from "wagmi";
import type { OnboardingProfile } from "@/types/onboarding";

const STORAGE_KEY = "finalboss:profile";

interface OnboardingContextValue {
  /** True once a wallet is connected or a signup was completed. */
  isOnboarded: boolean;
  /** True once we've finished checking localStorage and wagmi's reconnect attempt. */
  isResolved: boolean;
  profile: OnboardingProfile | null;
  markOnboarded: (profile: OnboardingProfile) => void;
  signOut: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isConnected, status } = useAccount();
  const { mutate: disconnect } = useDisconnect();
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          setProfile(JSON.parse(raw) as OnboardingProfile);
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setLocalReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const markOnboarded = useCallback((next: OnboardingProfile) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProfile(next);
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    if (isConnected) disconnect();
  }, [disconnect, isConnected]);

  const walletResolved = status !== "connecting" && status !== "reconnecting";

  const value: OnboardingContextValue = {
    isOnboarded: isConnected || profile !== null,
    isResolved: localReady && walletResolved,
    profile,
    markOnboarded,
    signOut,
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
