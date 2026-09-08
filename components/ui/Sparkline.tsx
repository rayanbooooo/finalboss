"use client";

import { useId } from "react";

interface SparklineProps {
  values: number[];
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

function toPoints(values: number[]): Point[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => ({
    x: (index / (values.length - 1)) * 100,
    y: 100 - ((value - min) / range) * 100,
  }));
}

/** Smooth curve through each point via quadratic bezier segments to their midpoints. */
function toSmoothPath(points: Point[]): string {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Clean smoothed line chart with a soft gradient fill - no charting library.
 * Uses vector-effect="non-scaling-stroke" because the viewBox is stretched
 * non-uniformly (preserveAspectRatio="none") to fill a wide, short box; a
 * plain stroke gets skewed into thick, uneven blobs under that stretch, so
 * the stroke width has to be pinned in screen space instead.
 */
export function Sparkline({ values, className }: SparklineProps) {
  const gradientId = useId();

  if (values.length < 2) return <div className={className} aria-hidden="true" />;

  const points = toPoints(values);
  const linePath = toSmoothPath(points);
  const areaPath = `${linePath} L 100 100 L 0 100 Z`;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
