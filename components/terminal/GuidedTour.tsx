"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { useTerminal } from "@/contexts/TerminalContext";
import { formatCurrency } from "@/lib/format";
import { MIN_LEVERAGE } from "@/lib/calculations";
import { cn } from "@/lib/utils";

export const TOUR_STORAGE_KEY = "finalboss:tour-done";

const PADDING = 8;
/** Gap between the spotlight ring and the card explaining it. */
const GAP = 14;
/** Keeps the card off the very edge of the viewport on every side. */
const MARGIN = 16;

interface Step {
  /** data-tour value of the element to spotlight. Absent = centred intro. */
  target?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Place your first trade",
    body: "Everything here runs on demo funds - nothing you do costs real money. The prices are real though, streamed live from Coinbase, so the outcomes are honest.",
  },
  {
    target: "direction",
    title: "Pick a direction",
    body: "Long profits if the price rises, Short profits if it falls. Choose whichever way you think the market is about to move.",
  },
  {
    target: "amount",
    title: "Choose your margin",
    body: "This is what you put at risk on the trade. The percentage buttons size it against your available balance. Lose the trade and you lose this, not more.",
  },
  {
    target: "leverage",
    title: "Set your leverage",
    body: "Leverage multiplies the gain and the loss by the same amount. Read the warning under the slider before you move it - it tells you exactly how small a move against you wipes the position out.",
  },
  {
    target: "submit",
    title: "Place the trade",
    body: "This opens the position immediately at the current market price. Your margin is locked while it's open.",
  },
  {
    target: "positions",
    title: "Watch it, then close it",
    body: "Your open position and its live profit or loss appear here. Close it whenever you like - or it closes itself if the price reaches your liquidation level.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Measurement {
  target: string;
  rect: Rect;
  position: { top: number; left: number };
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/**
 * Puts the card beside the spotlight, trying left, right, below then above, so
 * it never covers the thing it is describing and never leaves the viewport.
 */
function placeCard(rect: Rect, cardWidth: number, cardHeight: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (value: number, max: number) =>
    Math.max(MARGIN, Math.min(value, Math.max(MARGIN, max)));

  const leftOf = rect.left - PADDING - GAP - cardWidth;
  const rightOf = rect.left + rect.width + PADDING + GAP;

  if (leftOf >= MARGIN) {
    return { left: leftOf, top: clamp(rect.top, vh - cardHeight - MARGIN) };
  }
  if (rightOf + cardWidth <= vw - MARGIN) {
    return { left: rightOf, top: clamp(rect.top, vh - cardHeight - MARGIN) };
  }

  const left = clamp(rect.left, vw - cardWidth - MARGIN);
  const below = rect.top + rect.height + PADDING + GAP;
  if (below + cardHeight <= vh - MARGIN) return { left, top: below };

  const above = rect.top - PADDING - GAP - cardHeight;
  if (above >= MARGIN) return { left, top: above };

  return { left, top: clamp(rect.top, vh - cardHeight - MARGIN) };
}

export function GuidedTour() {
  const { availableBalance } = useTerminal();
  const [step, setStep] = useState<number | null>(null);
  // Keyed by the target it belongs to, so a stale measurement from the
  // previous step is simply ignored on render rather than having to be
  // cleared from inside an effect.
  const [measured, setMeasured] = useState<Measurement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        if (window.localStorage.getItem(TOUR_STORAGE_KEY) !== "true") setStep(0);
      } catch {
        // Storage blocked - skip the tour rather than trapping the user in it.
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const finish = useCallback(() => {
    setStep(null);
    setMeasured(null);
    try {
      window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      // Not persisting only means it runs again next visit.
    }
  }, []);

  const current = step === null ? null : STEPS[step];
  const target = current?.target;

  // The panels scroll independently inside the terminal shell, so the target
  // is measured live rather than assumed - and pulled into view first, since
  // the positions panel sits below the fold on shorter screens.
  useEffect(() => {
    if (!target) return undefined;

    let lastRect: Rect | null = null;

    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (!el) {
        lastRect = null;
        setMeasured(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const next = { top: r.top, left: r.left, width: r.width, height: r.height };
      // Skipping unchanged frames keeps this off the render path while the
      // user is reading a step.
      if (sameRect(lastRect, next)) return;
      lastRect = next;
      setMeasured({
        target,
        rect: next,
        position: placeCard(
          next,
          cardRef.current?.offsetWidth ?? 352,
          cardRef.current?.offsetHeight ?? 260
        ),
      });
    };

    document
      .querySelector(`[data-tour="${target}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });

    // First pass on the next frame rather than inline: it keeps the effect
    // body free of setState, and lets the scroll above settle before the
    // rect is read.
    const raf = requestAnimationFrame(measure);
    const id = window.setInterval(measure, 250);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [target]);

  if (step === null || !current) return null;

  const isLast = step === STEPS.length - 1;
  const active = measured && measured.target === target ? measured : null;

  const card = (
    <div
      ref={cardRef}
      className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-base-850/95 p-5 shadow-2xl backdrop-blur-xl"
    >
      <p className="font-mono text-[11px] uppercase tracking-wider text-violet-300">
        Step {step + 1} of {STEPS.length}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-white">{current.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{current.body}</p>

      {step === 0 && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {formatCurrency(availableBalance)} in demo funds is already in the account,
          ready to trade from {MIN_LEVERAGE}x.
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={finish}
          className="text-xs text-white/40 transition-colors hover:text-white/70"
        >
          Skip tour
        </button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => (isLast ? finish() : setStep(step + 1))}
          >
            {isLast ? "Start trading" : step === 0 ? "Show me around" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    // Click-through everywhere except the card itself, so the control being
    // explained stays usable while the tour is open.
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {target ? (
        <>
          {/* A transparent box over the target with an oversized shadow dims
              everything except the element being explained. */}
          {active && (
            <div
              className="absolute rounded-xl ring-2 ring-violet-400/70 transition-all duration-200"
              style={{
                top: active.rect.top - PADDING,
                left: active.rect.left - PADDING,
                width: active.rect.width + PADDING * 2,
                height: active.rect.height + PADDING * 2,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
              }}
            />
          )}
          <div
            // Hidden for the frame between a step change and its measurement,
            // so the card never flashes in the corner before it is placed.
            className={cn(
              "absolute transition-all duration-200",
              active ? "opacity-100" : "opacity-0"
            )}
            style={{ top: active?.position.top ?? MARGIN, left: active?.position.left ?? MARGIN }}
          >
            {card}
          </div>
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/75 p-4">
          {card}
        </div>
      )}
    </div>,
    document.body
  );
}
