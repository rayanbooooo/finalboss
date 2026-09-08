"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Client-side gate: /terminal requires a Supabase session, a connected
 * wallet, or a completed local signup. Waits for the auth check, the
 * localStorage read and wagmi's reconnect attempt to all settle before
 * redirecting, so a signed-in user isn't bounced during that flicker.
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
