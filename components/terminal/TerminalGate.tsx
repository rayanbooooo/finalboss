"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Interim client-side gate: /terminal requires a connected wallet or a
 * completed signup (localStorage flag) until real Supabase-backed accounts
 * land. Waits for wagmi's reconnect attempt to settle before redirecting,
 * so an already-onboarded user isn't bounced during the reconnect flicker.
 */
export function TerminalGate({ children }: { children: ReactNode }) {
  const { isOnboarded, isResolved } = useOnboarding();
  const router = useRouter();

  useEffect(() => {
    if (isResolved && !isOnboarded) {
      router.replace("/signup");
    }
  }, [isResolved, isOnboarded, router]);

  if (!isResolved || !isOnboarded) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-white/40" />
      </div>
    );
  }

  return <>{children}</>;
}
