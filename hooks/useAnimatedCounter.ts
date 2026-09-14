"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `target` once, then tracks it exactly.
 *
 * The intro animation is the only motion here. An earlier version also nudged
 * the value upward every few seconds, which existed purely to make three
 * hardcoded marketing numbers look like a live feed. Those numbers are real
 * now, so the drift would be inventing movement on top of measured data -
 * which is the one thing a number on a trading site must never do.
 *
 * The count-up starts at the first non-zero target, so a figure that arrives
 * from the network a second after mount still animates rather than snapping.
 */
export function useAnimatedCounter(target: number, durationMs = 1600): number {
  const [progress, setProgress] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || target <= 0) return undefined;
    startedRef.current = true;

    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - start) / durationMs);
      setProgress(1 - Math.pow(1 - elapsed, 3));
      if (elapsed < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return target * progress;
}
