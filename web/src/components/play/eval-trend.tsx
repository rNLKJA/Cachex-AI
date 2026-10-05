"use client";

import { useId } from "react";

import { formatScore } from "./explain-panel";

/**
 * Sparkline of the original evaluation function after each move.
 * Above the midline favours Red, below favours Blue.
 */
export function EvalTrend({ values }: { values: readonly number[] }) {
  const id = useId().replace(/:/g, "");
  const W = 320;
  const H = 96;
  const pad = 6;
  const maxAbs = Math.max(10, ...values.map((v) => Math.abs(v)));
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (W - pad * 2);
  const y = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - pad);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.at(-1) ?? 0;

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-24 w-full"
        role="img"
        aria-label={`Evaluation after each move; latest ${formatScore(last)}`}
      >
        <defs>
          <clipPath id={`${id}-top`}>
            <rect x="0" y="0" width={W} height={H / 2} />
          </clipPath>
          <clipPath id={`${id}-bottom`}>
            <rect x="0" y={H / 2} width={W} height={H / 2} />
          </clipPath>
        </defs>
        <line
          x1={pad}
          x2={W - pad}
          y1={H / 2}
          y2={H / 2}
          className="stroke-border"
          strokeDasharray="3 3"
        />
        {values.length > 1 && (
          <>
            <polyline
              points={points}
              fill="none"
              clipPath={`url(#${id}-top)`}
              style={{ stroke: "var(--player-red)" }}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <polyline
              points={points}
              fill="none"
              clipPath={`url(#${id}-bottom)`}
              style={{ stroke: "var(--player-blue)" }}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </>
        )}
        <circle
          cx={x(values.length - 1)}
          cy={y(last)}
          r={3.5}
          style={{ fill: last >= 0 ? "var(--player-red)" : "var(--player-blue)" }}
        />
      </svg>
      <figcaption className="text-muted-foreground flex justify-between text-xs">
        <span>Original evaluation after each move · higher favours Red</span>
        <span className="font-mono tabular-nums">{formatScore(last)}</span>
      </figcaption>
    </figure>
  );
}
