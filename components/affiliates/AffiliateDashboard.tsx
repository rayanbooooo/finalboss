"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Users } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClipboard } from "@/hooks/useClipboard";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { fetchReferralSummary, referralLink, type ReferralSummary } from "@/lib/referrals";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A referral link identifies an account, so there is nothing to show without
 * one. The previous version handed a link to anonymous visitors, freshly
 * generated on every render - it could never have tracked anybody.
 */
export function AffiliateDashboard() {
  const { userId, isResolved, profile } = useOnboarding();
  const { copied, copy } = useClipboard();
  // Keyed by the account it belongs to, so "loading" is derived rather than
  // toggled from inside the effect, and a stale result for a previous account
  // can't be displayed against the current one.
  const [loaded, setLoaded] = useState<{ userId: string; summary: ReferralSummary } | null>(
    null
  );
  const summary = loaded?.userId === userId ? loaded.summary : null;
  const loading = Boolean(userId) && summary === null;

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    void fetchReferralSummary(userId).then((result) => {
      if (!cancelled) setLoaded({ userId, summary: result });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!isResolved) {
    return (
      <GlassCard className="mx-auto flex max-w-2xl justify-center p-10">
        <Spinner className="h-7 w-7 text-white/40" />
      </GlassCard>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <GlassCard className="mx-auto max-w-2xl p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-white">Referrals are unavailable</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          This deployment has no backend connected, so referrals can&apos;t be tracked
          to an account.
        </p>
      </GlassCard>
    );
  }

  if (!userId) {
    return (
      <GlassCard className="mx-auto max-w-2xl p-6 text-center sm:p-8">
        <h3 className="text-lg font-semibold text-white">Sign in to get your link</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
          A referral link points at your account, so it only exists once you have one.
          {profile ? " This browser has a local profile, but referrals need a real account." : ""}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signin" className={cn(buttonVariants("primary", "lg"))}>
            Sign in
          </Link>
          <Link href="/signup" className={cn(buttonVariants("outline", "lg"))}>
            Create an account
          </Link>
        </div>
      </GlassCard>
    );
  }

  const link = summary?.code ? referralLink(summary.code) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Referrals" value={loading ? "—" : String(summary?.total ?? 0)} />
        <StatCard
          label="Your code"
          value={loading ? "—" : (summary?.code ?? "—")}
          mono
        />
        <StatCard
          label="Commission earned"
          value="$0.00"
          note="No fees have been charged yet, so there is nothing to share."
        />
      </div>

      <GlassCard className="mt-4 p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-white">Your referral link</h3>
        <p className="mt-1 text-sm text-white/50">
          Anyone who creates an account through this link is attributed to you, once.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="min-h-11 flex-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-violet-200">
            {link ?? "Generating…"}
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => link && copy(link)}
            disabled={!link}
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

      <GlassCard className="mt-4 p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-white">Accounts you referred</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6 text-white/40" />
          </div>
        ) : summary && summary.total > 0 ? (
          <ul className="mt-4 flex flex-col divide-y divide-white/5">
            {summary.joinedAt.map((at, i) => (
              <li key={at + i} className="flex items-center justify-between py-2.5 text-sm">
                {/* Deliberately no identity: knowing who signed up is not
                    something a referrer is entitled to. */}
                <span className="text-white/60">Account #{summary.total - i}</span>
                <span className="font-mono text-xs text-white/40">
                  {formatTimestamp(new Date(at).getTime())}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2">
            <EmptyState
              icon={Users}
              title="No referrals yet"
              description="Share your link above. Anyone who signs up through it shows up here."
            />
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  mono,
}: {
  label: string;
  value: string;
  note?: string;
  mono?: boolean;
}) {
  return (
    <GlassCard className="p-5">
      <span className="text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </span>
      <div className={cn("mt-2 text-2xl font-semibold text-white", mono && "font-mono text-xl")}>
        {value}
      </div>
      {note && <p className="mt-1.5 text-xs leading-relaxed text-white/35">{note}</p>}
    </GlassCard>
  );
}
