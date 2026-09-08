"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "finalboss:privacy-ack";

/**
 * Deliberately not a consent banner: this site sets no advertising or
 * analytics cookies, so there is nothing to consent to. It states what is
 * actually stored - browser storage for your profile, positions and sign-in
 * session - which is the honest version of the kit's cookie notice.
 */
export function PrivacyNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        setVisible(window.localStorage.getItem(STORAGE_KEY) !== "true");
      } catch {
        // Storage blocked - skip the notice rather than showing it forever.
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Not persisting it just means it shows again next visit.
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-base-850/95 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">How this site stores your data</p>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            No advertising or analytics cookies are used. Your profile, demo
            balance and positions are kept in this browser, and in your account
            if you create one, purely to make the app work. See the{" "}
            <Link href="/terms" className="text-violet-300 hover:underline">
              terms
            </Link>{" "}
            for details.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Button variant="outline" size="sm" onClick={dismiss} className="mt-3">
        Got it
      </Button>
    </div>
  );
}
