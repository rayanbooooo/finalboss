"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Spinner } from "@/components/ui/Spinner";
import { authLink } from "@/lib/navigation";

/**
 * Client-side gate: /terminal requires a Supabase session, a connected
 * wallet, or a completed local signup. Waits for the auth check, the
 * localStorage read and wagmi's reconnect attempt to all settle before
 * redirecting, so a signed-in user isn't bounced during that flicker.
 */
export function TerminalGate({ children }: { children: ReactNode }) {
  const { isOnboarded, isResolved } = useOnboarding();
  const router = useRouter();
  const pathname = usePathname();

  // Sign-in rather than sign-up: arriving here without a session usually means
  // a session ended, and answering that by opening the create-an-account wizard
  // made signing out look like it had wiped the account. The sign-in page links
  // onward to sign-up for people who genuinely need it.
  useEffect(() => {
    if (isResolved && !isOnboarded) {
      // Carry where they were trying to go, so signing in returns them there
      // rather than dumping everyone on the trade screen.
      router.replace(authLink("/signin", pathname));
    }
  }, [isResolved, isOnboarded, router, pathname]);

  if (!isResolved || !isOnboarded) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-white/40" />
      </div>
    );
  }

  return <>{children}</>;
}
