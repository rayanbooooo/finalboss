"use client";

import { Lock, Plus } from "lucide-react";
import { useTerminal, type AccountMode } from "@/contexts/TerminalContext";
import { useExchange } from "@/contexts/ExchangeContext";
import { cn } from "@/lib/utils";

/**
 * Which account the terminal is operating on.
 *
 * Note the wording: "Demo / Real", never "Live". The header
 * beside this already uses LIVE to mean the price feed is real, and letting
 * one word carry both meanings would blur the single most important
 * distinction in the app.
 */
const OPTIONS: { value: AccountMode; label: string; needsKey: boolean }[] = [
  { value: "demo", label: "Demo", needsKey: false },
  { value: "real", label: "Real", needsKey: true },
];

/** What stands between the user and this mode, if anything. */
type Blocker = "none" | "no-key" | "locked" | "pending" | "load-error";

export function AccountModeSwitch() {
  const { accountMode, setAccountMode } = useTerminal();
  const { isConnected, isUnlocked, sessionOnly, ready, loadError, openConnect, openUnlock } =
    useExchange();

  function blockerFor(option: (typeof OPTIONS)[number]): Blocker {
    if (!option.needsKey) return "none";
    if (!ready) return "pending";
    // Ordered before the no-key check on purpose: a lookup that failed is not
    // the same as an account with no key, and saying "connect one" to someone
    // who already has one is how a backend outage reads as user error.
    if (loadError && !isConnected) return "load-error";
    if (!isConnected) return "no-key";
    if (!isUnlocked && !sessionOnly) return "locked";
    return "none";
  }

  function handleClick(option: (typeof OPTIONS)[number], blocker: Blocker) {
    // The whole point of this rewrite: a mode you can't use yet is a prompt,
    // not a dead control. Previously these buttons were `disabled` with the
    // explanation in a `title` tooltip - which does not exist on a touch
    // device, so tapping "Real funds" on a phone did nothing at all, silently,
    // and there was no route from here to the connect flow in the first place.
    // A session-only key still works while the lookup is failing, so this
    // stays actionable rather than dead.
    if (blocker === "no-key" || blocker === "load-error") return openConnect();
    if (blocker === "locked") return openUnlock();
    if (blocker === "none") return setAccountMode(option.value);
  }

  const active = OPTIONS.find((option) => option.value === accountMode);
  const activeBlocker = active ? blockerFor(active) : "none";
  // Sitting on Demo is not itself blocked, but the user still needs to know why
  // the other two look different - so fall back to whatever is standing in the
  // way of the venue modes. no-key and locked apply to both equally.
  const venueBlocker = OPTIONS.filter((option) => option.needsKey)
    .map(blockerFor)
    .find(
      (blocker) =>
        blocker === "no-key" || blocker === "locked" || blocker === "load-error"
    );
  const shownBlocker = activeBlocker !== "none" ? activeBlocker : (venueBlocker ?? "none");
  const hasLoadError = shownBlocker === "load-error";
  const caption = captionFor(shownBlocker);

  return (
    <div className="flex w-full flex-col gap-1 lg:w-auto">
      <div
        className="flex w-full items-center gap-0.5 rounded-lg bg-white/5 p-0.5 lg:w-auto"
        role="group"
        aria-label="Account mode"
      >
        {OPTIONS.map((option) => {
          const blocker = blockerFor(option);
          // Only a genuinely impossible choice is disabled. Everything else is
          // a live control that opens whatever it needs.
          const disabled = blocker === "pending";
          const selected = accountMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => handleClick(option, blocker)}
              className={cn(
                "flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30 lg:min-h-0 lg:flex-none lg:py-1",
                selected
                  ? option.value === "real"
                    ? "bg-rose-500/20 text-rose-200"
                    : "bg-white/10 text-white"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              {option.label}
              {(blocker === "no-key" || blocker === "load-error") && (
                <Plus className="h-3 w-3 opacity-70" />
              )}
              {blocker === "locked" && <Lock className="h-3 w-3 opacity-70" />}
            </button>
          );
        })}
      </div>

      {/* Rendered text rather than a `title`: tooltips never appear on touch,
          which is where this control is hardest to figure out. */}
      {caption && (
        <p
          className={cn(
            "px-0.5 text-[11px] leading-snug lg:max-w-[15rem]",
            hasLoadError ? "text-amber-300/80" : "text-white/40"
          )}
        >
          {caption}
        </p>
      )}
    </div>
  );
}

function captionFor(blocker: Blocker): string | null {
  switch (blocker) {
    case "load-error":
      return "Couldn't check for a saved key — the account service isn't reachable.";
    case "no-key":
      return "Connect a Bybit key to trade your own account with real money.";
    case "locked":
      return "Your key is locked — unlock it to see this account.";
    default:
      return null;
  }
}
