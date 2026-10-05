"use client";

import { type KeyboardEvent, useCallback, useId, useMemo, useRef, useState } from "react";

import type { Colour, Coord } from "@/lib/cachex/types";
import { boardGeometry, toPath } from "@/lib/hex-geometry";
import { cn } from "@/lib/utils";

export type CellOverlay = "open" | "closed" | "current" | "path";

export interface CapturedCell {
  coord: Coord;
  colour: Colour;
}

export interface HexBoardProps {
  n: number;
  /** Row-major cell contents (index r * n + q). */
  cells: readonly (Colour | null)[];
  /** Accessible name for the board. */
  label: string;
  className?: string;
  onCellActivate?: (r: number, q: number) => void;
  isCellInteractive?: (r: number, q: number) => boolean;
  /** Colour of the ghost tile shown when hovering an empty, interactive cell. */
  previewColour?: Colour | null;
  lastMove?: Coord | null;
  /** Tokens removed by the latest move (animated out). */
  captured?: readonly CapturedCell[];
  /** Changes on every move so placement/capture animations replay. */
  moveKey?: string | number;
  winning?: readonly Coord[] | null;
  /** Cells to ring in gold (e.g. "play here" in illustrations). */
  highlights?: readonly Coord[];
  overlays?: ReadonlyMap<number, CellOverlay>;
  labels?: ReadonlyMap<number, string>;
  markers?: ReadonlyMap<number, "start" | "goal">;
  showCoords?: boolean;
  describeCell?: (r: number, q: number) => string | undefined;
}

const RADIUS = 10;

const tokenFill = (c: Colour, id: string) => `url(#${id}-${c})`;

export function HexBoard({
  n,
  cells,
  label,
  className,
  onCellActivate,
  isCellInteractive,
  previewColour = null,
  lastMove = null,
  captured = [],
  moveKey,
  winning = null,
  highlights,
  overlays,
  labels,
  markers,
  showCoords = false,
  describeCell,
}: HexBoardProps) {
  const uid = useId().replace(/:/g, "");
  const geo = useMemo(() => boardGeometry(n, RADIUS), [n]);
  const interactive = Boolean(onCellActivate);
  const [focusIdx, setFocusIdx] = useState(() => Math.floor(n / 2) * n + Math.floor(n / 2));
  const cellRefs = useRef<(SVGGElement | null)[]>([]);
  const safeFocus = focusIdx < n * n ? focusIdx : 0;

  const winningSet = useMemo(
    () => new Set((winning ?? []).map(([r, q]) => r * n + q)),
    [winning, n],
  );
  const highlightSet = useMemo(
    () => new Set((highlights ?? []).map(([r, q]) => r * n + q)),
    [highlights, n],
  );
  const lastIdx = lastMove ? lastMove[0] * n + lastMove[1] : -1;

  const moveFocus = useCallback(
    (idx: number) => {
      setFocusIdx(idx);
      cellRefs.current[idx]?.focus();
    },
    [setFocusIdx],
  );

  const onKeyDown = (e: KeyboardEvent<SVGGElement>, r: number, q: number) => {
    const deltas: Record<string, [number, number]> = {
      ArrowUp: [1, 0],
      ArrowDown: [-1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const d = deltas[e.key];
    if (d) {
      e.preventDefault();
      const nr = Math.min(n - 1, Math.max(0, r + d[0]));
      const nq = Math.min(n - 1, Math.max(0, q + d[1]));
      moveFocus(nr * n + nq);
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && onCellActivate) {
      e.preventDefault();
      if (!isCellInteractive || isCellInteractive(r, q)) onCellActivate(r, q);
    }
  };

  const edgeWidth = RADIUS * 0.42;

  return (
    <svg
      viewBox={geo.viewBox}
      className={cn("h-auto w-full select-none", className)}
      role={interactive ? "group" : "img"}
      aria-label={label}
    >
      <defs>
        <linearGradient id={`${uid}-empty`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--hex-hi)" }} />
          <stop offset="100%" style={{ stopColor: "var(--hex-lo)" }} />
        </linearGradient>
        {(["red", "blue"] as const).map((c) => (
          <radialGradient key={c} id={`${uid}-${c}`} cx="40%" cy="30%" r="80%">
            <stop offset="0%" style={{ stopColor: `var(--player-${c}-hi)` }} />
            <stop offset="65%" style={{ stopColor: `var(--player-${c})` }} />
            <stop offset="100%" style={{ stopColor: `var(--player-${c}-lo)` }} />
          </radialGradient>
        ))}
        {(["red", "blue"] as const).map((c) => (
          <filter key={c} id={`${uid}-glow-${c}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation={RADIUS * 0.28}
              style={{ floodColor: `var(--player-${c})`, floodOpacity: "var(--glow-strength)" }}
            />
          </filter>
        ))}
        {/* Goal-edge glow: the zigzag edges have very flat bounding boxes, so
            the default objectBoundingBox region would clip the blur into a
            hard rectangle. Use the whole board (plus margin) as the region. */}
        {(["red", "blue"] as const).map((c) => (
          <filter
            key={c}
            id={`${uid}-edge-${c}`}
            filterUnits="userSpaceOnUse"
            x={-RADIUS * 2}
            y={-RADIUS * 2}
            width={geo.width + RADIUS * 4}
            height={geo.height + RADIUS * 4}
          >
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation={RADIUS * 0.28}
              style={{ floodColor: `var(--player-${c})`, floodOpacity: "var(--glow-strength)" }}
            />
          </filter>
        ))}
        <filter id={`${uid}-gold`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation={RADIUS * 0.3}
            style={{ floodColor: "var(--gold)", floodOpacity: 0.8 }}
          />
        </filter>
      </defs>

      {/* board plate */}
      <path
        d={toPath(geo.outline, true)}
        style={{ fill: "var(--plate)", stroke: "var(--plate)" }}
        strokeWidth={RADIUS * 1.1}
        strokeLinejoin="round"
      />

      {/* goal edges: Red top/bottom, Blue left/right */}
      {(
        [
          ["top", "red"],
          ["bottom", "red"],
          ["left", "blue"],
          ["right", "blue"],
        ] as const
      ).map(([edge, colour]) => (
        <path
          key={edge}
          d={toPath(geo.edges[edge])}
          fill="none"
          style={{ stroke: `var(--player-${colour})` }}
          strokeWidth={edgeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${uid}-edge-${colour})`}
          opacity={0.9}
        />
      ))}

      {Array.from({ length: n * n }, (_, idx) => {
        const r = Math.floor(idx / n);
        const q = idx % n;
        const token = cells[idx];
        const canAct = interactive && (!isCellInteractive || isCellInteractive(r, q));
        const overlay = overlays?.get(idx);
        const text = labels?.get(idx);
        const marker = markers?.get(idx);
        const c = geo.centre(r, q);
        const isWinning = winningSet.has(idx);
        const extra = describeCell?.(r, q);
        const aria = `Row ${r}, column ${q}: ${token ?? "empty"}${extra ? `, ${extra}` : ""}`;

        return (
          <g
            key={idx}
            ref={(el) => {
              cellRefs.current[idx] = el;
            }}
            className="hex-cell"
            data-interactive={canAct}
            role={interactive ? "button" : undefined}
            aria-label={interactive ? aria : undefined}
            aria-disabled={interactive ? !canAct : undefined}
            tabIndex={interactive ? (idx === safeFocus ? 0 : -1) : undefined}
            onClick={canAct ? () => onCellActivate?.(r, q) : undefined}
            onFocus={interactive ? () => setFocusIdx(idx) : undefined}
            onKeyDown={interactive ? (e) => onKeyDown(e, r, q) : undefined}
          >
            {/* empty face with bevel */}
            <polygon
              className="hex-face"
              points={geo.hexPoints(r, q, 0.94)}
              fill={`url(#${uid}-empty)`}
              style={{ stroke: "var(--hex-stroke)" }}
              strokeWidth={0.6}
            />

            {overlay === "closed" && (
              <polygon
                points={geo.hexPoints(r, q, 0.94)}
                style={{ fill: "var(--gold)" }}
                opacity={0.16}
              />
            )}
            {overlay === "open" && (
              <polygon
                points={geo.hexPoints(r, q, 0.72)}
                fill="none"
                style={{ stroke: "var(--gold)" }}
                strokeWidth={1.1}
                strokeDasharray="2.2 1.6"
              />
            )}

            {token && (
              <g filter={`url(#${uid}-glow-${token})`}>
                <polygon
                  key={idx === lastIdx ? `tok-${moveKey}` : "tok"}
                  className={cn("hex-cell", idx === lastIdx && "animate-hex-pop")}
                  points={geo.hexPoints(r, q, 0.9)}
                  fill={tokenFill(token, uid)}
                />
                <polygon
                  points={geo.hexPoints(r, q, 0.66)}
                  fill="none"
                  stroke="white"
                  strokeOpacity={0.18}
                  strokeWidth={0.7}
                />
              </g>
            )}

            {!token && canAct && previewColour && (
              <polygon
                className="hex-preview"
                points={geo.hexPoints(r, q, 0.82)}
                fill={tokenFill(previewColour, uid)}
              />
            )}

            {isWinning && (
              <polygon
                className="animate-win-pulse"
                points={geo.hexPoints(r, q, 0.98)}
                fill="none"
                style={{ stroke: "var(--gold)" }}
                strokeWidth={1.4}
                filter={`url(#${uid}-gold)`}
              />
            )}

            {highlightSet.has(idx) && (
              <polygon
                points={geo.hexPoints(r, q, 0.8)}
                fill="none"
                style={{ stroke: "var(--gold)" }}
                strokeWidth={1.4}
                strokeDasharray="2.4 1.8"
              />
            )}

            {overlay === "path" && (
              <polygon
                points={geo.hexPoints(r, q, 0.6)}
                style={{ fill: "var(--gold)" }}
                filter={`url(#${uid}-gold)`}
                opacity={0.95}
              />
            )}
            {overlay === "current" && (
              <polygon
                className="animate-win-pulse"
                points={geo.hexPoints(r, q, 0.94)}
                fill="none"
                style={{ stroke: "var(--gold)" }}
                strokeWidth={1.8}
                filter={`url(#${uid}-gold)`}
              />
            )}

            {idx === lastIdx && token && (
              <circle cx={c.x} cy={c.y} r={RADIUS * 0.14} fill="white" opacity={0.85} />
            )}

            {marker && (
              <g aria-hidden>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={RADIUS * 0.5}
                  style={{ fill: "var(--background)", stroke: "var(--gold-ink)" }}
                  strokeWidth={1.2}
                />
                <text
                  x={c.x}
                  y={c.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-mono"
                  style={{ fill: "var(--gold-ink)", fontSize: RADIUS * 0.62, fontWeight: 700 }}
                >
                  {marker === "start" ? "S" : "G"}
                </text>
              </g>
            )}

            {!marker && text && (
              <text
                x={c.x}
                y={c.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="font-mono"
                style={{
                  fill: overlay === "path" ? "var(--background)" : "var(--foreground)",
                  fontSize: RADIUS * 0.55,
                  fontWeight: 600,
                }}
                aria-hidden
              >
                {text}
              </text>
            )}

            {showCoords && !marker && !text && (
              <text
                x={c.x}
                y={c.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="font-mono"
                style={{
                  fill: token ? "white" : "var(--muted-foreground)",
                  fontSize: RADIUS * 0.36,
                  opacity: token ? 0.85 : 0.7,
                }}
                aria-hidden
              >
                {r},{q}
              </text>
            )}

            {interactive && (
              <polygon
                className="hex-focus"
                points={geo.hexPoints(r, q, 0.98)}
                fill="none"
                stroke="transparent"
                opacity={0}
              />
            )}
          </g>
        );
      })}

      {/* tokens captured by the latest move */}
      {captured.map(({ coord: [r, q], colour }) => {
        const c = geo.centre(r, q);
        return (
          <g key={`cap-${moveKey}-${r}-${q}`} aria-hidden pointerEvents="none">
            <polygon
              className="hex-cell animate-hex-capture"
              points={geo.hexPoints(r, q, 0.9)}
              fill={tokenFill(colour, uid)}
            />
            <circle
              className="hex-cell animate-hex-ring"
              cx={c.x}
              cy={c.y}
              r={RADIUS * 0.8}
              fill="none"
              style={{ stroke: `var(--player-${colour === "red" ? "blue" : "red"})` }}
              strokeWidth={1.2}
            />
          </g>
        );
      })}
    </svg>
  );
}
