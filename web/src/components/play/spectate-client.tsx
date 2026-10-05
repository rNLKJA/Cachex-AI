"use client";

import { Pause, Play, Repeat, Shuffle, StepForward } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { type MatchConfig, useCachexMatch } from "@/hooks/use-cachex-match";
import { randomSeed } from "@/lib/rng";
import { BoardLegend } from "./board-legend";
import { EvalTrend } from "./eval-trend";
import { ExplainPanel } from "./explain-panel";
import { MatchBoard } from "./match-board";
import { MatchStatus } from "./match-status";
import { MoveLog } from "./move-log";
import { BoardSizeSelect, ColourDot, Field, Panel, Segmented } from "./primitives";

type Agent = "minimax" | "random";

const AGENT_OPTIONS = [
  { value: "minimax" as const, label: "Minimax" },
  { value: "random" as const, label: "Random" },
];

export function SpectateClient() {
  const [n, setN] = useState(6);
  const [red, setRed] = useState<Agent>("minimax");
  const [blue, setBlue] = useState<Agent>("minimax");
  const [seed, setSeed] = useState(2022);
  const [playing, setPlaying] = useState(false);
  const [delay, setDelay] = useState(600);
  const [showCoords, setShowCoords] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const config: MatchConfig = useMemo(() => ({ n, red, blue, seed }), [blue, n, red, seed]);
  const match = useCachexMatch(config, { autoPlay: playing, moveDelayMs: delay });
  const { game } = match.view;
  const over = game.over();

  const restart = (changes: Partial<{ n: number; red: Agent; blue: Agent; seed: number }> = {}) => {
    if (changes.n !== undefined) setN(changes.n);
    if (changes.red !== undefined) setRed(changes.red);
    if (changes.blue !== undefined) setBlue(changes.blue);
    setSeed(changes.seed ?? seed);
    setSelected(null);
    // A finished game ends auto-play: restarting from it starts paused.
    if (over) setPlaying(false);
    match.reset();
  };

  const lastExplained = Object.keys(match.meta)
    .map(Number)
    .sort((a, b) => b - a)[0];
  const shown = selected !== null && match.meta[selected] ? selected : lastExplained;

  return (
    <div className="table-felt">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="mb-6 max-w-2xl">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            Spectator mode
          </p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">AI vs AI</h1>
          <p className="text-muted-foreground mt-2">
            Pit the minimax agent against itself or the random baseline. Every game is reproducible
            from its seed, which drives the move shuffle and the tie-breaking bias the original
            agent used.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <MatchStatus
              game={game}
              kinds={config}
              thinking={match.thinking}
              error={match.error}
              paused={!playing && !match.thinking}
            />
            <div className="bg-card/40 rounded-3xl border p-2 sm:p-6">
              <MatchBoard
                n={n}
                view={match.view}
                moveCount={match.actions.length}
                humanColour={null}
                showCoords={showCoords}
                className="lg:max-h-[calc(100svh-22rem)]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  // Resuming follows the latest move again (explained moves keep their commentary).
                  if (!playing) setSelected(null);
                  setPlaying(!playing);
                }}
                disabled={over}
                aria-pressed={playing && !over}
              >
                {playing && !over ? <Pause /> : <Play />} {playing && !over ? "Pause" : "Play"}
              </Button>
              <Button
                variant="outline"
                onClick={match.step}
                disabled={playing || over || match.thinking}
              >
                <StepForward /> Step
              </Button>
              <Button variant="outline" onClick={() => restart()}>
                <Repeat /> Replay seed
              </Button>
              <Button variant="outline" onClick={() => restart({ seed: randomSeed() })}>
                <Shuffle /> New seed
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Switch id="spectate-coords" checked={showCoords} onCheckedChange={setShowCoords} />
                <Label htmlFor="spectate-coords" className="text-muted-foreground text-sm">
                  Coordinates
                </Label>
              </div>
            </div>
            <BoardLegend />
          </div>

          <aside className="space-y-4" aria-label="Spectator controls">
            <Panel
              title="Match setup"
              action={<span className="text-muted-foreground font-mono text-xs">seed {seed}</span>}
            >
              <div className="space-y-4">
                <Field label="Board size" htmlFor="spectate-size">
                  <BoardSizeSelect
                    id="spectate-size"
                    value={n}
                    onChange={(v) => restart({ n: v })}
                  />
                </Field>
                <Field label="Red (moves first)">
                  <Segmented
                    label="Red agent"
                    value={red}
                    onChange={(v) => restart({ red: v })}
                    options={AGENT_OPTIONS}
                  />
                </Field>
                <Field label="Blue">
                  <Segmented
                    label="Blue agent"
                    value={blue}
                    onChange={(v) => restart({ blue: v })}
                    options={AGENT_OPTIONS}
                  />
                </Field>
                <Field
                  label={
                    <>
                      Move delay:{" "}
                      <span className="font-mono tracking-normal normal-case">{delay} ms</span>
                    </>
                  }
                  htmlFor="speed"
                >
                  <Slider
                    id="speed"
                    aria-label="Move delay"
                    getValueText={(v) => `${v} ms`}
                    min={0}
                    max={2000}
                    step={50}
                    value={[delay]}
                    onValueChange={([v]) => setDelay(v)}
                  />
                </Field>
              </div>
            </Panel>

            <Panel
              title="Evaluation trend"
              action={
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <ColourDot colour="red" /> vs <ColourDot colour="blue" />
                </span>
              }
            >
              <EvalTrend values={match.trend} />
            </Panel>

            <Panel title="Why that move?">
              <ExplainPanel
                meta={shown !== undefined ? match.meta[shown] : undefined}
                action={shown !== undefined ? match.actions[shown] : undefined}
                colour={shown !== undefined ? (shown % 2 === 0 ? "red" : "blue") : undefined}
                turn={shown !== undefined ? shown + 1 : undefined}
                n={n}
                // Pause autoplay and pin this move, so the next move does not replace
                // the one being explained while the model is answering.
                onExplainStart={() => {
                  setPlaying(false);
                  if (shown !== undefined) setSelected(shown);
                }}
              />
            </Panel>

            <Panel title="Move log">
              <MoveLog
                log={game.log}
                kinds={config}
                meta={match.meta}
                selected={shown ?? null}
                onSelect={setSelected}
              />
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}
