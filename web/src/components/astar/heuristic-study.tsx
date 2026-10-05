"use client";

import { FlaskConical, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAstarBenchmark } from "@/hooks/use-astar-benchmark";
import { useElementWidth } from "@/hooks/use-element-width";
import type { BenchmarkRow } from "@/lib/astar/random-board";
import { randomSeed } from "@/lib/rng";

// The notebook looped `for i in range(100)`, skipping i < 2: every size from 2 to 99.
const DIMENSIONS = Array.from({ length: 98 }, (_, i) => i + 2);
const FIRST = DIMENSIONS[0];
const LAST = DIMENSIONS.at(-1)!;

export function HeuristicStudy() {
  const { state, run } = useAstarBenchmark();

  return (
    <section aria-labelledby="study-title" className="bg-card/40 rounded-3xl border p-4 sm:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            Heuristic study
          </p>
          <h2 id="study-title" className="mt-1 text-2xl font-semibold sm:text-3xl">
            Manhattan vs Euclidean, revisited
          </h2>
          <p className="text-muted-foreground mt-2">
            Our report compared node expansions on random boards from the notebook&apos;s generator
            (random barriers, random start and goal) and found the two heuristics similar on small
            boards, with Manhattan expanding slightly fewer nodes as boards grew. Re-run the
            experiment here: one random board for every size from {FIRST} × {FIRST} to {LAST} ×{" "}
            {LAST}, counted the way the notebook counted them.
          </p>
        </div>
        <Button onClick={() => run(DIMENSIONS, randomSeed())} disabled={state.status === "running"}>
          {state.status === "running" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          {state.status === "done" ? "Re-run with a new seed" : "Run the study"}
        </Button>
      </div>

      <div className="mt-6">
        {state.status === "idle" && (
          <div className="text-muted-foreground flex h-56 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-sm">
            Press &ldquo;Run the study&rdquo; to generate {DIMENSIONS.length} random boards in a Web
            Worker.
          </div>
        )}
        {state.status === "running" && (
          <div
            className="text-muted-foreground flex h-56 items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-center text-sm"
            role="status"
          >
            <Loader2 className="size-4 shrink-0 animate-spin" /> Running {DIMENSIONS.length * 2}{" "}
            searches ({DIMENSIONS.length} boards × 2 heuristics)…
          </div>
        )}
        {state.status === "error" && (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/10 rounded-xl border p-4 text-sm"
          >
            {state.message}
          </p>
        )}
        {state.status === "done" && (
          <StudyChart rows={state.rows} seed={state.seed} elapsedMs={state.elapsedMs} />
        )}
      </div>
    </section>
  );
}

function StudyChart({
  rows,
  seed,
  elapsedMs,
}: {
  rows: BenchmarkRow[];
  seed: number;
  elapsedMs: number;
}) {
  // Draw at the container's real width so the axis labels stay legible.
  const [boxRef, measured] = useElementWidth<HTMLDivElement>(760);
  const W = Math.max(280, measured);
  const H = W < 480 ? 220 : 260;
  const m = { l: 48, r: 10, t: 12, b: 34 };
  const maxY = Math.max(10, ...rows.flatMap((r) => [r.manhattan, r.euclidean]));
  const minX = rows[0].dimension;
  const maxX = rows.at(-1)!.dimension;
  const x = (d: number) => m.l + ((d - minX) / (maxX - minX || 1)) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - (v / maxY) * (H - m.t - m.b);
  const line = (key: "manhattan" | "euclidean") =>
    rows.map((r) => `${x(r.dimension).toFixed(1)},${y(r[key]).toFixed(1)}`).join(" ");

  const mWins = rows.filter((r) => r.manhattan < r.euclidean).length;
  const eWins = rows.filter((r) => r.euclidean < r.manhattan).length;
  const ties = rows.length - mWins - eWins;
  const sumM = rows.reduce((s, r) => s + r.manhattan, 0);
  const sumE = rows.reduce((s, r) => s + r.euclidean, 0);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  const tickStep = W < 480 ? 40 : 20;
  const xTicks = rows
    .filter((r) => r.dimension % tickStep === 0 || r.dimension === minX)
    .map((r) => r.dimension);

  const series = [
    { key: "manhattan" as const, label: "Manhattan", colour: "var(--chart-3)", dash: undefined },
    { key: "euclidean" as const, label: "Euclidean", colour: "var(--chart-4)", dash: "5 4" },
  ];

  return (
    <figure>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary label="Manhattan expanded fewer" value={`${mWins} of ${rows.length}`} />
        <Summary
          label="Euclidean expanded fewer"
          value={`${eWins} of ${rows.length}`}
          hint={ties ? `${ties} ties` : undefined}
        />
        <Summary
          label="Total expansions (M / E)"
          value={`${sumM.toLocaleString("en-AU")} / ${sumE.toLocaleString("en-AU")}`}
        />
      </div>
      <div ref={boxRef} className="w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block h-auto w-full"
          role="img"
          aria-label={`Node expansions by board size. Manhattan expanded fewer nodes on ${mWins} boards, Euclidean on ${eWins}.`}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="stroke-border" />
              <text
                x={m.l - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="central"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {t.toLocaleString("en-AU")}
              </text>
            </g>
          ))}
          {xTicks.map((d) => (
            <text
              key={d}
              x={x(d)}
              y={H - m.b + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {d}
            </text>
          ))}
          <text
            x={(m.l + W - m.r) / 2}
            y={H - 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            Board dimension n
          </text>
          {series.map((s) => (
            <polyline
              key={s.key}
              points={line(s.key)}
              fill="none"
              style={{ stroke: s.colour }}
              strokeWidth={2}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
      <figcaption className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-2">
            <svg width="22" height="6" aria-hidden>
              <line
                x1="0"
                x2="22"
                y1="3"
                y2="3"
                style={{ stroke: s.colour }}
                strokeWidth={2}
                strokeDasharray={s.dash}
              />
            </svg>
            {s.label}
          </span>
        ))}
        <span>
          Metric: the notebook&apos;s expansion counter (nodes added to the queue after the start)
        </span>
        <span className="ml-auto font-mono">
          seed {seed} · {Math.round(elapsedMs)} ms in a Web Worker
        </span>
      </figcaption>
    </figure>
  );
}

function Summary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-background/50 rounded-xl border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-0.5 font-mono text-lg tabular-nums">{value}</div>
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  );
}
