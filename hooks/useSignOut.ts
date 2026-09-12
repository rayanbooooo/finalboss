"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useToast } from "@/contexts/ToastContext";

/**
 * Signing out, everywhere it happens, with the two things every call site was
 * missing: waiting for the result, and going somewhere useful afterwards.
 *
 * Every caller previously handed the raw `signOut` straight to an onClick. It
 * returned void, so a Supabase failure was invisible and the user was left
 * looking at a signed-out UI over a session that was still alive. And from the
 * terminal the only navigation came from the route gate noticing the user had
 * gone and pushing them to `/signup` - the create-an-account wizard - which is
 * a strange place to land when what you wanted was a different account.
 */
export function useSignOut(): { signOut: () => Promise<void>; signingOut: boolean } {
  const { signOut: endSession } = useOnboarding();
  const { toast } = useToast();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    const { error } = await endSession();
    setSigningOut(false);

    if (error) {
      toast({
        variant: "error",
        title: "Could not sign out",
        description: `${error} Your session may still be active — try again before using this browser to sign in as someone else.`,
      });
      return;
    }
    router.replace("/signin");
  }, [endSession, router, toast]);

  return { signOut, signingOut };
}
