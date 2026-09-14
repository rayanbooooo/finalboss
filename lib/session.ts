import type { OnboardingProfile } from "@/types/onboarding";

/**
 * What it means to have an account on FinalBoss.
 *
 * Extracted into one testable function because the expression it replaced was
 * the source of a whole class of bugs:
 *
 *   isOnboarded: isConnected || userId !== null || profile !== null
 *
 * Three unrelated signals, two of which create no account anywhere. A MetaMask
 * connection registers nothing on any server - it reads a public address and a
 * balance, and that is the entire extent of it. A localStorage profile is a
 * blob this browser wrote to itself. Treating either as "signed in" is what
 * made the sign-in page unreachable, made the affiliates page a dead end that
 * demanded "a real account" from someone the app already considered signed in,
 * and put two identity chips in the terminal header at once.
 *
 * An account is a Supabase session. That is the only thing that owns persisted
 * positions, carries a referral code, and survives a change of browser.
 */
export interface SessionSignals {
  /** Supabase user id, or null when there is no session. */
  userId: string | null;
  /** The locally stored profile, if this browser has one. */
  profile: OnboardingProfile | null;
  /** Whether a backend exists to have an account on at all. */
  supabaseConfigured: boolean;
}

export function isSignedIn({ userId, profile, supabaseConfigured }: SessionSignals): boolean {
  if (userId !== null) return true;

  // The one case where a local profile still counts: no backend is configured,
  // so a Supabase session cannot exist and the local profile is the only
  // account there is. Without this branch a deployment (or a dev checkout)
  // missing its env vars locks every gated screen behind a sign-in that can
  // never succeed.
  return !supabaseConfigured && profile !== null;
}
