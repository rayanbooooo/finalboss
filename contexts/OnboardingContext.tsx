"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { MIN_LEVERAGE } from "@/lib/calculations";
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
  updateProfile: (changes: Partial<OnboardingProfile>) => Promise<void>;
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
    defaultLeverage: MIN_LEVERAGE,
    createdAt: Date.now(),
  };
}

/** Read outside React state so the value is current at the moment a session
 * arrives, rather than whatever a closure captured earlier. */
function readStoredProfile(): OnboardingProfile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingProfile) : null;
  } catch {
    return null;
  }
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

    /**
     * Loads the account's profile, creating the row if it doesn't exist yet.
     *
     * Creating it here rather than during sign-up is what makes this correct
     * when the project requires email confirmation: sign-up has no session to
     * write with, so the row has to be written on the first authenticated
     * load instead. Doing it at sign-up only meant every confirmed account
     * ended up with no profile at all, and the answers the user gave in the
     * wizard were silently discarded.
     */
    async function loadProfile(id: string, email: string | undefined) {
      const { data, error } = await supabase!
        .from("profiles")
        .select("display_name, method, experience_level, risk_tolerance, default_leverage")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;

      if (error) {
        console.error("Could not load profile:", error.message);
        setProfile(readStoredProfile() ?? fallbackProfile(email));
        return;
      }

      if (data) {
        setProfile({
          method: data.method,
          email,
          displayName: data.display_name,
          experienceLevel: data.experience_level,
          riskTolerance: data.risk_tolerance,
          defaultLeverage: data.default_leverage,
          createdAt: Date.now(),
        });
        return;
      }

      // No row yet: use the answers kept locally through the confirmation
      // round-trip, falling back to something sane if they're gone.
      const pending = readStoredProfile() ?? fallbackProfile(email);
      // ignoreDuplicates makes this insert-if-absent. getSession() and
      // onAuthStateChange can both land here for the same account, and the
      // loser of that race must not fail or overwrite.
      const { error: writeError } = await supabase!.from("profiles").upsert(
        {
          id,
          display_name: pending.displayName,
          method: pending.method,
          experience_level: pending.experienceLevel,
          risk_tolerance: pending.riskTolerance,
          default_leverage: pending.defaultLeverage,
        },
        { onConflict: "id", ignoreDuplicates: true }
      );
      if (writeError) console.error("Could not create profile:", writeError.message);
      if (cancelled) return;
      setProfile({ ...pending, email });
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const user = data.session?.user;
        if (user) {
          setUserId(user.id);
          void loadProfile(user.id, user.email);
        }
      })
      .catch((error) => {
        // Unreachable backend must not wedge the app: without this the
        // ready flag never flips, and every gated screen renders an
        // infinite spinner instead of falling back to the local profile.
        console.error("Could not restore session:", error);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
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

  const updateProfile = useCallback(
    async (changes: Partial<OnboardingProfile>) => {
      const next = profile ? { ...profile, ...changes } : null;
      if (!next) return;
      setProfile(next);

      const supabase = getSupabase();
      if (supabase && userId) {
        const { error } = await supabase
          .from("profiles")
          .update({
            display_name: next.displayName,
            experience_level: next.experienceLevel,
            risk_tolerance: next.riskTolerance,
            default_leverage: next.defaultLeverage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
        if (error) console.error("Could not save profile:", error.message);
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
    [profile, userId]
  );

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
        // Email confirmation is on, so there is no session to write the
        // profile with yet. Keep the answers locally - loadProfile writes the
        // row on the first authenticated load. Without this the whole wizard
        // is discarded the moment the user goes to check their inbox.
        markOnboarded(next);
        return { status: "confirm-email" };
      }

      // Session available immediately (confirmation off). Still an upsert
      // rather than an insert, because onAuthStateChange may already have
      // fired and created the row from the stored profile.
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.session.user.id,
          display_name: next.displayName,
          method: next.method,
          experience_level: next.experienceLevel,
          risk_tolerance: next.riskTolerance,
          default_leverage: next.defaultLeverage,
        },
        { onConflict: "id" }
      );
      if (profileError) return { status: "error", message: profileError.message };

      setUserId(data.session.user.id);
      markOnboarded(next);
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
    updateProfile,
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
