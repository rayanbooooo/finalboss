"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  SESSION_WINDOWS,
  SILVER_BULLET_WINDOWS,
  etParts,
  formatEtClock,
  formatEtMinute,
  isMarketOpen,
  sessionAt,
  silverBulletAt,
} from "@/lib/mnq/sessions";

const MINUTES_IN_DAY = 1440;

const TONE_CLASS: Record<string, string> = {
  violet: "bg-violet-500/35 border-violet-400/40",
  emerald: "bg-emerald-500/30 border-emerald-400/40",
  amber: "bg-amber-500/25 border-amber-400/35",
  slate: "bg-white/8 border-white/15",
};

/**
 * The ET trading day as a single bar, with the current moment marked.
 *
 * Rendered client-side only. The server has no idea what time it is in the
 * user's session and a server-rendered clock would hydrate to a different
 * value, so this starts empty and fills in after mount.
 */
export function SessionRail() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Priming with a frame callback rather than calling setNow() straight from
    // the effect body: a synchronous setState there triggers an immediate extra
    // render pass before paint, for a clock that is about to tick anyway.
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(id);
    };
  }, []);

  const parts = now === null ? null : etParts(now);
  const session = now === null ? null : sessionAt(now);
  const silverBullet = now === null ? null : silverBulletAt(now);
  const open = now === null ? null : isMarketOpen(now);

  return (
    <section className="glass-panel p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-sm tracking-wide text-white/80">Session</h2>
          <span className="font-mono text-lg tabular-nums text-white/90">
            {now === null ? "--:--:--" : formatEtClock(now)}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-white/35">ET</span>
        </div>
        <div className="flex items-center gap-2">
          {silverBullet && (
            <span className="rounded-full border border-violet-400/40 bg-violet-500/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
              {silverBullet.label}
            </span>
          )}
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
              open
                ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
                : "border border-white/15 bg-white/5 text-white/45",
            )}
          >
            {open === null ? "···" : open ? (session?.label ?? "Open") : "Closed"}
          </span>
        </div>
      </header>

      <div className="relative h-7 overflow-hidden rounded-lg border border-white/8 bg-base-900/60">
        {SESSION_WINDOWS.map((window, index) => (
          <div
            key={`${window.id}-${index}`}
            className={clsx("absolute top-0 h-full border-x", TONE_CLASS[window.tone])}
            style={{
              left: `${(window.startMinute / MINUTES_IN_DAY) * 100}%`,
              width: `${((window.endMinute - window.startMinute) / MINUTES_IN_DAY) * 100}%`,
            }}
            title={`${window.label} · ${formatEtMinute(window.startMinute)}–${formatEtMinute(window.endMinute)} ET`}
          >
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center truncate px-1 font-mono text-[9px] uppercase tracking-wider text-white/70">
              {window.label}
            </span>
          </div>
        ))}

        {/* Silver bullet hours as hatched slivers inside their killzones. */}
        {SILVER_BULLET_WINDOWS.map((window) => (
          <div
            key={window.label}
            className="absolute top-0 h-full border-x border-violet-300/50 bg-violet-300/20"
            style={{
              left: `${(window.startMinute / MINUTES_IN_DAY) * 100}%`,
              width: `${((window.endMinute - window.startMinute) / MINUTES_IN_DAY) * 100}%`,
            }}
            title={window.label}
          />
        ))}

        {parts && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
            style={{ left: `${(parts.minuteOfDay / MINUTES_IN_DAY) * 100}%` }}
          />
        )}
      </div>

      <div className="mt-1.5 flex justify-between font-mono text-[9px] text-white/30">
        {["00:00", "06:00", "12:00", "18:00", "24:00"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </section>
  );
}
