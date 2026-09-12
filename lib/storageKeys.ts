/**
 * Every localStorage key this app writes, in one place.
 *
 * Collected here because sign-out has to know the full list. It used to clear
 * only the profile, so the next person to sign in on the same browser
 * inherited the previous account's positions, demo balance, venue mode,
 * pending referral code and completed-walkthrough flag - state that looks like
 * their own and, in the case of positions and balance, is someone else's
 * trading history.
 */
export const STORAGE_KEYS = {
  profile: "finalboss:profile",
  accountMode: "finalboss:account-mode",
  positions: "finalboss:positions",
  funding: "finalboss:funding",
  tourDone: "finalboss:tour-done",
  startTour: "finalboss:start-tour",
  pendingReferral: "finalboss:pending-referral",
  sidebarCollapsed: "finalboss:sidebar-collapsed",
  privacyAck: "finalboss:privacy-ack",
} as const;

/**
 * Keys that belong to whoever is signed in, and so must not outlive them.
 *
 * `sidebarCollapsed` and `privacyAck` are deliberately absent: they describe
 * the browser rather than the account, and resetting a collapsed sidebar or
 * re-showing a dismissed privacy notice on every sign-out would be a bug of
 * its own.
 */
export const PER_USER_STORAGE_KEYS: readonly string[] = [
  STORAGE_KEYS.profile,
  STORAGE_KEYS.accountMode,
  STORAGE_KEYS.positions,
  STORAGE_KEYS.funding,
  STORAGE_KEYS.tourDone,
  STORAGE_KEYS.startTour,
  STORAGE_KEYS.pendingReferral,
];

/**
 * Scopes a store to one account so two accounts on the same browser cannot
 * read each other's rows even before sign-out gets a chance to clear them.
 */
export function scopedKey(base: string, userId: string | null): string {
  return `${base}:${userId ?? "local"}`;
}

/** Removes every per-user key, plus any account-scoped variant of them. */
export function clearPerUserStorage(): void {
  try {
    const scoped: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && PER_USER_STORAGE_KEYS.some((base) => key.startsWith(`${base}:`))) {
        scoped.push(key);
      }
    }
    [...PER_USER_STORAGE_KEYS, ...scoped].forEach((key) =>
      window.localStorage.removeItem(key)
    );
  } catch {
    // Storage blocked. Nothing was persisted either, so nothing to clear.
  }
}
