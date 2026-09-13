/** Where auth sends you when nothing else is specified. */
export const DEFAULT_AFTER_AUTH = "/terminal";

/**
 * Validates a `?next=` destination before it is used to navigate.
 *
 * The value arrives from the URL, so it is whatever the person who wrote the
 * link wanted it to be. Handing it straight to `router.push` turns every
 * sign-in link into an open redirect: someone sends a link with an off-site
 * `next`, the victim signs in for real on this site, and is then dropped on a
 * page that looks like it and asks for something else.
 *
 * Only a path on this site is allowed through:
 *
 * - must start with a slash, so absolute URLs are out;
 * - must not start with two slashes, or a slash and a backslash, which
 *   browsers resolve as protocol-relative and therefore off-site. This is the
 *   case a naive startsWith("/") check misses;
 * - no control characters, which can be used to smuggle past naive checks.
 */
export function safeRedirect(
  next: string | null | undefined,
  fallback = DEFAULT_AFTER_AUTH
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

/** Builds a sign-in or sign-up link that returns to `from` afterwards. */
export function authLink(path: "/signin" | "/signup", from: string): string {
  return `${path}?next=${encodeURIComponent(from)}`;
}
