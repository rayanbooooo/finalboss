"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterOptions {
  durationMs?: number;
  nudgeIntervalMs?: number;
  nudgeMin?: number;
  nudgeMax?: number;
}

export function useAnimatedCounter(seed: number, options: AnimatedCounterOptions = {}) {
  const { durationMs = 1600, nudgeIntervalMs = 3200, nudgeMin = 0, nudgeMax = 0 } = options;
  const [value, setValue] = useState(0);
  const seedRef = useRef(seed);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const to = seedRef.current;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(to * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  useEffect(() => {
    if (nudgeMax <= 0) return undefined;
    const interval = setInterval(() => {
      setValue((prev) => prev + nudgeMin + Math.random() * (nudgeMax - nudgeMin));
    }, nudgeIntervalMs);
    return () => clearInterval(interval);
  }, [nudgeIntervalMs, nudgeMin, nudgeMax]);

  return value;
}
