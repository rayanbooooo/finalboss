"use client";

import { clsx } from "clsx";
import type { Confluence } from "@/lib/mnq/setups";

/**
 * Why a setup scored what it scored.
 *
 * A bare number invites blind trust. Showing which factors were met, and what
 * each was worth, lets the trader disagree with the scorer — which is the
 * point, because the weights are a starting opinion, not a fact.
 */
export function ConfluenceMeter({ confluences }: { confluences: Confluence[] }) {
  return (
    <ul className="space-y-1">
      {confluences.map((factor) => (
        <li key={factor.label} className="flex items-center gap-2">
          <span
            className={clsx(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              factor.met ? "bg-emerald-400 shadow-glow-emerald" : "bg-white/15",
            )}
          />
          <span className={clsx("flex-1 truncate text-[11px]", factor.met ? "text-white/80" : "text-white/35")}>
            {factor.label}
          </span>
          {factor.detail && (
            <span className="max-w-[45%] truncate font-mono text-[10px] text-white/30" title={factor.detail}>
              {factor.detail}
            </span>
          )}
          <span className={clsx("w-6 text-right font-mono text-[10px]", factor.met ? "text-emerald-400/80" : "text-white/20")}>
            {factor.met ? `+${factor.weight}` : factor.weight}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Circular score badge, coloured by confidence band. */
export function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const radius = size / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  const stroke = score >= 70 ? "#a78bfa" : score >= 55 ? "#34d399" : "#fbbf24";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-label={`Score ${score}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontSize={size * 0.32}
        fontFamily="var(--font-geist-mono), monospace"
      >
        {score}
      </text>
    </svg>
  );
}
