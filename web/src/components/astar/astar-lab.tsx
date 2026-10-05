"use client";

import {
  Check,
  CircleDot,
  Copy,
  Eraser,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  SkipForward,
  StepForward,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { type CellOverlay, HexBoard } from "@/components/board/hex-board";
import { ColourDot, Field, Panel, Segmented } from "@/components/play/primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  type AStarBoard,
  type AStarResult,
  type BlockMode,
  type Heuristic,
  astar,
  formatCliOutput,
} from "@/lib/astar/astar";
import { parsePartAInput, stringifyPartAInput } from "@/lib/astar/input";
import { searchFrame } from "@/lib/astar/playback";
import { DEFAULT_PRESET, PRESETS, type Preset } from "@/lib/astar/presets";
import { randomNotebookBoard } from "@/lib/astar/random-board";
import type { Colour, Coord } from "@/lib/cachex/types";
import { createRng, randomSeed } from "@/lib/rng";
import { cn } from "@/lib/utils";

type Tool = "red" | "blue" | "erase" | "start" | "goal";
type BlockChoice = "any" | "red" | "blue";

const BLOCK_OF: Record<BlockChoice, BlockMode> = { any: null, red: "red", blue: "blue" };
const BLOCK_CLI: Record<BlockChoice, string> = { any: "", red: " Red", blue: " Blue" };

const presetBoard = (p: Preset) => parsePartAInput(JSON.stringify(p.input));

function emptyBoard(n: number): AStarBoard {
  return { n, cells: new Array(n * n).fill(null), start: [n - 1, Math.floor(n / 2)], goal: [0, 0] };
}

type Outcome = { ok: true; result: AStarResult } | { ok: false; error: string };

function runSafe(board: AStarBoard, heuristic: Heuristic, block: BlockMode): Outcome {
  try {
    return { ok: true, result: astar(board, heuristic, block) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const samePath = (a: readonly Coord[], b: readonly Coord[]) =>
  a.length === b.length && a.every((c, i) => c[0] === b[i][0] && c[1] === b[i][1]);

export function AstarLab() {
  const [board, setBoard] = useState<AStarBoard>(() => presetBoard(DEFAULT_PRESET));
  const [presetId, setPresetId] = useState<string | null>(DEFAULT_PRESET.id);
  const [tool, setTool] = useState<Tool>("blue");
  const [heuristic, setHeuristic] = useState<Heuristic>("euclidean");
  const [block, setBlock] = useState<BlockChoice>("any");
  const [frame, setFrame] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [stepMs, setStepMs] = useState(280);
  const [jsonText, setJsonText] = useState(() => stringifyPartAInput(presetBoard(DEFAULT_PRESET)));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const preset = PRESETS.find((p) => p.id === presetId) ?? null;
  const blockMode = BLOCK_OF[block];

  const outcome = useMemo(
    () => runSafe(board, heuristic, blockMode),
    [board, heuristic, blockMode],
  );
  const compare = useMemo(
    () => ({
      manhattan: runSafe(board, "manhattan", blockMode),
      euclidean: runSafe(board, "euclidean", blockMode),
    }),
    [board, blockMode],
  );

  const total = outcome.ok ? outcome.result.steps.length : 0;
  const shownFrame = frame ?? total;
  const view = useMemo(
    () => (outcome.ok ? searchFrame(outcome.result, board.n, board.start, shownFrame) : null),
    [outcome, board.n, board.start, shownFrame],
  );

  // playback timer: stops by itself once the last expansion is shown
  const isPlaying = playing && shownFrame < total;
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setFrame((f) => Math.min((f ?? 0) + 1, total));
    }, stepMs);
    return () => clearInterval(timer);
  }, [isPlaying, stepMs, total]);

  /** Apply a board edit; the result is recomputed and shown in full. */
  const commit = (next: AStarBoard, keepPreset = false) => {
    setBoard(next);
    setFrame(null);
    setPlaying(false);
    setJsonText(stringifyPartAInput(next));
    setJsonError(null);
    if (!keepPreset) setPresetId(null);
  };

  const onCell = (r: number, q: number) => {
    const idx = r * board.n + q;
    const cells = board.cells.slice();
    const isStart = board.start[0] === r && board.start[1] === q;
    const isGoal = board.goal[0] === r && board.goal[1] === q;
    if (tool === "start" || tool === "goal") {
      if ((tool === "start" && isGoal) || (tool === "goal" && isStart)) return;
      cells[idx] = null;
      commit({ ...board, cells, [tool]: [r, q] as Coord });
      return;
    }
    if (isStart || isGoal) return;
    const colour: Colour | null = tool === "erase" ? null : tool;
    cells[idx] = cells[idx] === colour ? null : colour;
    commit({ ...board, cells });
  };

  const loadPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    commit(presetBoard(p), true);
    setPresetId(id);
    setBlock("any");
    if (p.originalHeuristic) setHeuristic(p.originalHeuristic);
  };

  const loadJson = () => {
    try {
      commit(parsePartAInput(jsonText));
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : String(err));
    }
  };

  const randomise = () => {
    const rng = createRng(randomSeed());
    commit(randomNotebookBoard(board.n, rng));
  };

  const togglePlay = () => {
    if (!outcome.ok) return;
    if (isPlaying) {
      setPlaying(false);
      return;
    }
    if (shownFrame >= total) setFrame(0);
    setPlaying(true);
  };

  const stepOnce = () => {
    setPlaying(false);
    setFrame((f) => (f === null || f >= total ? 1 : f + 1));
  };

  // overlays for the board
  const { overlays, labels, markers } = useMemo(() => {
    const overlays = new Map<number, CellOverlay>();
    const labels = new Map<number, string>();
    const markers = new Map<number, "start" | "goal">([
      [board.start[0] * board.n + board.start[1], "start"],
      [board.goal[0] * board.n + board.goal[1], "goal"],
    ]);
    if (outcome.ok && view) {
      for (const i of view.closed) overlays.set(i, "closed");
      for (const i of view.open) overlays.set(i, "open");
      if (view.done) {
        outcome.result.path.forEach(([r, q], k) => {
          const i = r * board.n + q;
          overlays.set(i, "path");
          labels.set(i, String(k + 1));
        });
      } else if (view.current !== null) {
        overlays.set(view.current, "current");
      }
    }
    return { overlays, labels, markers };
  }, [board, outcome, view]);

  const path = outcome.ok ? outcome.result.path : [];
  const cli = outcome.ok ? formatCliOutput(path) : "";
  const matchesOriginal =
    preset &&
    preset.originalPath !== undefined &&
    block === "any" &&
    heuristic === preset.originalHeuristic
      ? samePath(path, preset.originalPath ?? [])
      : null;

  return (
    <section aria-labelledby="lab-title">
      <div className="mb-6 max-w-2xl">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
          Part A · Search
        </p>
        <h1 id="lab-title" className="mt-1 text-3xl font-semibold sm:text-4xl">
          A* Lab
        </h1>
        <p className="text-muted-foreground mt-2">
          Paint tiles, move the start and goal, and watch our original A* search expand the board.
          The port keeps the original priority queue and tie-breaking, so paths and node counts
          match the Python program exactly.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="bg-card/40 rounded-3xl border p-2 sm:p-6">
            <HexBoard
              n={board.n}
              cells={board.cells}
              label={`A* board ${board.n} by ${board.n}. Tool: ${tool}. Use arrow keys and Enter to edit.`}
              onCellActivate={onCell}
              overlays={overlays}
              labels={labels}
              markers={markers}
              previewColour={tool === "red" || tool === "blue" ? tool : null}
              describeCell={(r, q) => {
                const i = r * board.n + q;
                if (markers.get(i) === "start") return "start";
                if (markers.get(i) === "goal") return "goal";
                const o = overlays.get(i);
                return o === "path" ? `path step ${labels.get(i)}` : o;
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={togglePlay} disabled={!outcome.ok || total === 0}>
              {isPlaying ? <Pause /> : <Play />} {isPlaying ? "Pause" : "Animate search"}
            </Button>
            <Button variant="outline" onClick={stepOnce} disabled={!outcome.ok}>
              <StepForward /> Step
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPlaying(false);
                setFrame(null);
              }}
              disabled={shownFrame >= total}
            >
              <SkipForward /> Result
            </Button>
            <div className="ml-auto flex min-w-48 flex-1 items-center gap-3 sm:max-w-64">
              <span className="text-muted-foreground text-xs whitespace-nowrap">Speed</span>
              <Slider
                aria-label="Milliseconds per expansion"
                min={40}
                max={800}
                step={20}
                value={[840 - stepMs]}
                onValueChange={([v]) => setStepMs(840 - v)}
              />
            </div>
          </div>

          <Legend />
        </div>

        <aside className="space-y-4" aria-label="A* controls">
          <Panel title="Search">
            <div className="space-y-4">
              <Field label="Heuristic">
                <Segmented
                  label="Heuristic"
                  value={heuristic}
                  onChange={(v) => {
                    setHeuristic(v);
                    setFrame(null);
                    setPlaying(false);
                  }}
                  options={[
                    { value: "manhattan", label: "Manhattan" },
                    { value: "euclidean", label: "Euclidean" },
                  ]}
                />
              </Field>
              <Field
                label="Obstacles"
                htmlFor="block-mode"
                hint="Mirrors the optional block-type argument of python -m search."
              >
                <Select
                  value={block}
                  onValueChange={(v) => {
                    setBlock(v as BlockChoice);
                    setFrame(null);
                    setPlaying(false);
                  }}
                >
                  <SelectTrigger id="block-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Every tile blocks (default)</SelectItem>
                    <SelectItem value="blue">Only Blue tiles block</SelectItem>
                    <SelectItem value="red">Only Red tiles block</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {outcome.ok ? (
                <div className="grid grid-cols-3 gap-2" aria-live="polite">
                  <Counter label="Expanded" value={view?.expanded ?? 0} />
                  <Counter label="Queued" value={view?.pushes ?? 0} />
                  <Counter label="Path cost" value={view?.done ? path.length : "…"} />
                </div>
              ) : (
                <p
                  role="alert"
                  className="border-destructive/40 bg-destructive/10 rounded-lg border p-3 text-sm"
                >
                  {outcome.error}
                </p>
              )}
              {outcome.ok && view?.done && path.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No path: the goal is unreachable, so the original prints{" "}
                  <code className="font-mono">0</code>.
                </p>
              )}

              <CompareTable compare={compare} active={heuristic} />
            </div>
          </Panel>

          <Panel title="Edit board">
            <div className="space-y-4">
              <Field label="Tool">
                <Segmented
                  label="Editing tool"
                  value={tool}
                  onChange={setTool}
                  options={[
                    {
                      value: "blue",
                      label: <ColourDot colour="blue" />,
                      ariaLabel: "Paint blue tile",
                    },
                    {
                      value: "red",
                      label: <ColourDot colour="red" />,
                      ariaLabel: "Paint red tile",
                    },
                    { value: "erase", label: <Eraser className="size-4" />, ariaLabel: "Erase" },
                    { value: "start", label: <Flag className="size-4" />, ariaLabel: "Move start" },
                    { value: "goal", label: <Target className="size-4" />, ariaLabel: "Move goal" },
                  ]}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Size" htmlFor="lab-size">
                  <Select
                    value={String(board.n)}
                    onValueChange={(v) => commit(emptyBoard(Number(v)))}
                  >
                    <SelectTrigger id="lab-size" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 13 }, (_, i) => i + 3).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} × {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Preset" htmlFor="lab-preset">
                  <Select value={presetId ?? ""} onValueChange={loadPreset}>
                    <SelectTrigger id="lab-preset" className="w-full">
                      <SelectValue placeholder="Custom board" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESETS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={randomise}>
                  <Shuffle /> Random board
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => commit({ ...board, cells: board.cells.map(() => null) })}
                >
                  <Trash2 /> Clear tiles
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadPreset(DEFAULT_PRESET.id)}>
                  <RotateCcw /> Reset
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Output">
            <p className="text-muted-foreground mb-2 font-mono text-xs">
              $ python -m search input.json{BLOCK_CLI[block]}
            </p>
            <pre className="bg-background/60 max-h-52 overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">
              {outcome.ok ? (view?.done ? cli : "…searching") : "error"}
            </pre>
            {preset && (
              <p className="text-muted-foreground mt-2 text-xs">
                Source: <span className="font-mono">{preset.source}</span>
              </p>
            )}
            {matchesOriginal !== null && view?.done && (
              <p
                className={cn(
                  "mt-2 flex items-center gap-1.5 text-sm",
                  matchesOriginal ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                )}
              >
                {matchesOriginal ? <Check className="size-4" /> : <X className="size-4" />}
                {matchesOriginal
                  ? "Matches the output recorded in the original repo"
                  : "Differs from the recorded output"}
              </p>
            )}
          </Panel>

          <Panel
            title="Input JSON"
            action={
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  void navigator.clipboard?.writeText(jsonText).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  });
                }}
              >
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
              </Button>
            }
          >
            <Textarea
              aria-label="Board in the original sample_input.json format"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              className="h-44 font-mono text-xs"
            />
            {jsonError && (
              <p role="alert" className="text-destructive mt-2 text-sm">
                {jsonError}
              </p>
            )}
            <Button className="mt-3" size="sm" variant="outline" onClick={loadJson}>
              <Upload /> Load JSON
            </Button>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function Counter({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-background/50 rounded-lg border px-2.5 py-2">
      <div className="text-muted-foreground text-[0.65rem] tracking-wide uppercase">{label}</div>
      <div className="font-mono text-lg tabular-nums">{value}</div>
    </div>
  );
}

function CompareTable({
  compare,
  active,
}: {
  compare: Record<Heuristic, Outcome>;
  active: Heuristic;
}) {
  const m = compare.manhattan;
  const e = compare.euclidean;
  if (!m.ok || !e.ok) return null;
  const rows: { label: string; m: number; e: number }[] = [
    { label: "Path cost", m: m.result.path.length, e: e.result.path.length },
    { label: "Expanded", m: m.result.pops, e: e.result.pops },
    { label: "Queued", m: m.result.pushes, e: e.result.pushes },
  ];
  return (
    <table className="w-full text-xs">
      <caption className="text-muted-foreground mb-1 text-left text-xs font-medium tracking-wide uppercase">
        Both heuristics on this board
      </caption>
      <thead className="text-muted-foreground">
        <tr className="border-b">
          <th scope="col" className="py-1 text-left font-medium" />
          <th
            scope="col"
            className={cn(
              "py-1 text-right font-medium",
              active === "manhattan" && "text-foreground",
            )}
          >
            Manhattan
          </th>
          <th
            scope="col"
            className={cn(
              "py-1 text-right font-medium",
              active === "euclidean" && "text-foreground",
            )}
          >
            Euclidean
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-border/50 border-b last:border-0">
            <th scope="row" className="py-1.5 text-left font-normal">
              {row.label}
            </th>
            <td
              className={cn(
                "py-1.5 text-right font-mono tabular-nums",
                row.m < row.e && "text-gold font-semibold",
              )}
            >
              {row.m}
            </td>
            <td
              className={cn(
                "py-1.5 text-right font-mono tabular-nums",
                row.e < row.m && "text-gold font-semibold",
              )}
            >
              {row.e}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Legend() {
  const item = "flex items-center gap-2";
  return (
    <div className="bg-card/40 text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border p-4 text-sm">
      <span className={item}>
        <span className="border-gold text-gold flex size-5 items-center justify-center rounded-full border font-mono text-[0.6rem] font-bold">
          S
        </span>
        Start
      </span>
      <span className={item}>
        <span className="border-gold text-gold flex size-5 items-center justify-center rounded-full border font-mono text-[0.6rem] font-bold">
          G
        </span>
        Goal
      </span>
      <span className={item}>
        <CircleDot className="text-gold size-4" /> Open (queued)
      </span>
      <span className={item}>
        <span className="bg-gold/25 size-4 rounded-sm" /> Closed (expanded)
      </span>
      <span className={item}>
        <span className="bg-gold size-4 rounded-sm" /> Path, numbered like the original display
      </span>
    </div>
  );
}
