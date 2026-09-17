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
  saveRunDismissed: "finalboss:save-run-dismissed",
  asterAgent: "finalboss:aster-agent",
} as const;

/**
 * Keys that belong to whoever is signed in, and so must not outlive them.
 *
 * `sidebarCollapsed`, `privacyAck` and `saveRunDismissed` are deliberately
 * absent: they describe the browser rather than the account, and resetting a
 * collapsed sidebar or re-showing a dismissed notice on every sign-out would be
 * a bug of its own. `saveRunDismissed` in particular only ever applies to
 * someone who has no account, so clearing it per account would mean nothing.
 */
export const PER_USER_STORAGE_KEYS: readonly string[] = [
  STORAGE_KEYS.profile,
  STORAGE_KEYS.accountMode,
  STORAGE_KEYS.positions,
  STORAGE_KEYS.funding,
  STORAGE_KEYS.tourDone,
  STORAGE_KEYS.startTour,
  STORAGE_KEYS.pendingReferral,
  // An approved agent authorises trading on one person's exchange account. It
  // must never outlive their session on a shared browser, even encrypted.
  STORAGE_KEYS.asterAgent,
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
