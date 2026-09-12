"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { storePendingReferral } from "@/lib/referrals";
import { Spinner } from "@/components/ui/Spinner";

export function ReferralCapture({ code }: { code: string }) {
  const router = useRouter();

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      storePendingReferral(code);
      // Replace, not push: the referral URL should not sit in history for the
      // back button to land on again.
      router.replace("/signup");
    });
    return () => cancelAnimationFrame(raf);
  }, [code, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Spinner className="h-7 w-7 text-white/40" />
      <p className="text-sm text-white/50">Taking you to sign up…</p>
    </div>
  );
}
