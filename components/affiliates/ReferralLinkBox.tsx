"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useClipboard } from "@/hooks/useClipboard";
import { generateId } from "@/lib/utils";

const PLACEHOLDER_CODE = "••••••••";

export function ReferralLinkBox() {
  const [code, setCode] = useState<string | null>(null);
  const { copied, copy } = useClipboard();

  // Generated post-mount (client-only) since it's derived from Date.now(),
  // which would otherwise differ between the server render and the
  // client's hydration pass and trigger a hydration mismatch.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setCode(generateId("ref").slice(-8).toUpperCase());
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const link = useMemo(
    () => `https://finalboss.trade/r/${code ?? PLACEHOLDER_CODE}`,
    [code]
  );

  return (
    <GlassCard className="mx-auto max-w-2xl p-6 sm:p-8">
      <h3 className="text-lg font-semibold text-white">Your referral link</h3>
      <p className="mt-1 text-sm text-white/50">
        Share this link — everyone who signs up through it is tracked to your
        account.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="min-h-11 flex-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-violet-200">
          {link}
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => copy(link)}
          disabled={!code}
          className="sm:w-40"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copy
            </>
          )}
        </Button>
      </div>
    </GlassCard>
  );
}
