"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { OnboardingProfile } from "@/types/onboarding";

const STORAGE_KEY = "finalboss:profile";

export type SignUpResult =
  | { status: "active" }
  | { status: "confirm-email" }
  | { status: "error"; message: string };

interface OnboardingContextValue {
  /** True once a wallet is connected, a Supabase session exists, or a local signup was completed. */
  isOnboarded: boolean;
  /** True once we've finished checking auth, localStorage and wagmi's reconnect attempt. */
  isResolved: boolean;
  profile: OnboardingProfile | null;
  /** Supabase user id when signed in - this is what scopes persisted positions. */
  userId: string | null;
  markOnboarded: (profile: OnboardingProfile) => void;
  signUpWithEmail: (
    email: string,
    password: string,
    profile: OnboardingProfile
  ) => Promise<SignUpResult>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Keeps the UI coherent when a session exists but its profile row doesn't. */
function fallbackProfile(email: string | undefined): OnboardingProfile {
  return {
    method: "email",
    email,
    displayName: email ? email.split("@")[0] : "Trader",
    experienceLevel: "some",
    riskTolerance: "moderate",
    defaultLeverage: 10,
    createdAt: Date.now(),
  };
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isConnected, status } = useAccount();
  const { mutate: disconnect } = useDisconnect();
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

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

  // A Supabase session always wins over the local profile: it's the account
  // that actually owns the persisted positions.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return undefined;
    let cancelled = false;

    async function loadProfile(id: string, email: string | undefined) {
      const { data } = await supabase!
        .from("profiles")
        .select("display_name, method, experience_level, risk_tolerance, default_leverage")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      setProfile(
        data
          ? {
              method: data.method,
              email,
              displayName: data.display_name,
              experienceLevel: data.experience_level,
              riskTolerance: data.risk_tolerance,
              defaultLeverage: data.default_leverage,
              createdAt: Date.now(),
            }
          : fallbackProfile(email)
      );
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (user) {
        setUserId(user.id);
        void loadProfile(user.id, user.email);
      }
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const user = session?.user;
      setUserId(user?.id ?? null);
      if (user) void loadProfile(user.id, user.email);
      setAuthReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const markOnboarded = useCallback((next: OnboardingProfile) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProfile(next);
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, next: OnboardingProfile): Promise<SignUpResult> => {
      const supabase = getSupabase();
      if (!supabase) {
        // No backend configured - fall back to the local-only account so the
        // signup flow still completes instead of dead-ending.
        markOnboarded(next);
        return { status: "active" };
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { status: "error", message: error.message };

      if (!data.session) {
        // Project has email confirmation switched on; there's no session to
        // write the profile with until they click the link.
        return { status: "confirm-email" };
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.session.user.id,
        display_name: next.displayName,
        method: next.method,
        experience_level: next.experienceLevel,
        risk_tolerance: next.riskTolerance,
        default_leverage: next.defaultLeverage,
      });
      if (profileError) return { status: "error", message: profileError.message };

      setUserId(data.session.user.id);
      setProfile(next);
      return { status: "active" };
    },
    [markOnboarded]
  );

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: "Sign-in is unavailable until the backend is configured." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setUserId(null);
    void getSupabase()?.auth.signOut();
    if (isConnected) disconnect();
  }, [disconnect, isConnected]);

  const walletResolved = status !== "connecting" && status !== "reconnecting";

  const value: OnboardingContextValue = {
    isOnboarded: isConnected || userId !== null || profile !== null,
    isResolved: localReady && walletResolved && authReady,
    profile,
    userId,
    markOnboarded,
    signUpWithEmail,
    signInWithEmail,
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
