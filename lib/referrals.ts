/**
 * Referral codes and attribution.
 *
 * The previous implementation generated a code from Date.now() in the browser
 * on every render, so the "your referral link" box handed out a different link
 * each time and nothing could ever be tracked to it. A code has to belong to an
 * account and never change, so it is generated once and stored on the profile.
 */

import { getSupabase } from "@/lib/supabase";
import { STORAGE_KEYS } from "@/lib/storageKeys";

/** Where a code picked up from a /r/<code> link waits until there's a session
 * to attribute it to. Signing up usually involves leaving for an inbox, so it
 * has to survive that. */
const PENDING_KEY = STORAGE_KEYS.pendingReferral;

/** No 0/O/1/I: these get read off a screen and typed by hand. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateReferralCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function referralLink(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/r/${code}`;
}

export function storePendingReferral(code: string): void {
  try {
    window.localStorage.setItem(PENDING_KEY, code.toUpperCase());
  } catch {
    // Storage blocked - the referral just isn't attributed.
  }
}

export function readPendingReferral(): string | null {
  try {
    return window.localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function clearPendingReferral(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to do.
  }
}

/**
 * Attributes a stored code to the signed-in account. Safe to call on every
 * load: the unique constraint on referred_id makes a second attempt a no-op,
 * and the code is only cleared once the server has actually seen it.
 */
export async function attributePendingReferral(): Promise<void> {
  const code = readPendingReferral();
  const supabase = getSupabase();
  if (!code || !supabase) return;

  const { error } = await supabase.rpc("attribute_referral", { code });
  if (error) {
    // Keep the code for a later attempt rather than losing the attribution to
    // a dropped connection.
    console.error("Could not attribute referral:", error.message);
    return;
  }
  clearPendingReferral();
}

export interface ReferralSummary {
  code: string | null;
  total: number;
  joinedAt: string[];
}

/** Real counts only. There is no fee data behind this yet, so the dashboard
 * shows what actually exists rather than inventing earnings. */
export async function fetchReferralSummary(userId: string): Promise<ReferralSummary> {
  const supabase = getSupabase();
  if (!supabase) return { code: null, total: 0, joinedAt: [] };

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("referral_code").eq("id", userId).maybeSingle(),
    supabase
      .from("referrals")
      .select("created_at")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    code: profile?.referral_code ?? null,
    total: rows?.length ?? 0,
    joinedAt: (rows ?? []).map((r: { created_at: string }) => r.created_at),
  };
}
