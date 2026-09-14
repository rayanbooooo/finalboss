import { describe, expect, it } from "vitest";
import { isSignedIn } from "@/lib/session";
import type { OnboardingProfile } from "@/types/onboarding";

const profile = { displayName: "Rayan" } as OnboardingProfile;

describe("isSignedIn", () => {
  it("is true for a Supabase session", () => {
    expect(isSignedIn({ userId: "u_1", profile: null, supabaseConfigured: true })).toBe(true);
  });

  /**
   * The bug this function exists for. A wallet connection is not represented
   * here at all - there is no `isConnected` field to pass - which is the point:
   * connecting MetaMask creates no account, so it cannot make this true.
   */
  it("is false when a local profile is the only credential and a backend exists", () => {
    expect(isSignedIn({ userId: null, profile, supabaseConfigured: true })).toBe(false);
  });

  /** The regression this could cause: no env vars means no session is possible,
   * so the local profile has to count or the app is unreachable. */
  it("is true for a local profile when no backend is configured", () => {
    expect(isSignedIn({ userId: null, profile, supabaseConfigured: false })).toBe(true);
  });

  it("is false with nothing at all, configured or not", () => {
    expect(isSignedIn({ userId: null, profile: null, supabaseConfigured: true })).toBe(false);
    expect(isSignedIn({ userId: null, profile: null, supabaseConfigured: false })).toBe(false);
  });

  it("lets a session win over a stale local profile from another account", () => {
    expect(isSignedIn({ userId: "u_2", profile, supabaseConfigured: true })).toBe(true);
  });
});
