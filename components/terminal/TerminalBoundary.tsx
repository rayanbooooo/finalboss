"use client";

import type { ReactNode } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Waits for auth to settle, then renders the terminal. It does not gate it.
 *
 * This used to bounce anyone without a session to /signin, which put a
 * four-step signup wizard between a stranger and the only thing this product
 * does that nothing else does: let them watch what 1000x actually costs, for
 * free, on live prices. That is the wrong order. The demo is the pitch, so it
 * has to come before the form, not after it.
 *
 * Nothing about identity changed to allow this - `isSignedIn` still means a
 * real Supabase session and nothing else. The terminal simply stopped
 * requiring one. What still does require an account is everything that
 * outlives the browser tab: saved positions, a referral code, and connecting an
 * exchange key for Real mode.
 *
 * The wait is still needed. Rendering before auth resolves would show a
 * returning user the signed-out terminal for a frame and re-run their
 * walkthrough.
 */
export function TerminalBoundary({ children }: { children: ReactNode }) {
  const { isResolved } = useOnboarding();

  if (!isResolved) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-white/40" />
      </div>
    );
  }

  return <>{children}</>;
}
