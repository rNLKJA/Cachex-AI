"use client";

import { ArrowLeftRight, RotateCcw, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type MatchConfig, useCachexMatch } from "@/hooks/use-cachex-match";
import { STEAL, type Colour, place } from "@/lib/cachex/types";
import { randomSeed } from "@/lib/rng";
import { ExplainPanel } from "./explain-panel";
import { MatchBoard } from "./match-board";
import { MatchStatus } from "./match-status";
import { MoveLog } from "./move-log";
import { BoardLegend } from "./board-legend";
import { BoardSizeSelect, ColourDot, Field, Panel, Segmented } from "./primitives";

type Opponent = "minimax" | "random";

export function PlayClient() {
  const [n, setN] = useState(5);
  const [human, setHuman] = useState<Colour>("red");
  const [opponent, setOpponent] = useState<Opponent>("minimax");
  const [seed, setSeed] = useState(4399);
  const [showCoords, setShowCoords] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const config: MatchConfig = useMemo(
    () => ({
      n,
      red: human === "red" ? "human" : opponent,
      blue: human === "blue" ? "human" : opponent,
      seed,
    }),
    [human, n, opponent, seed],
  );
  const match = useCachexMatch(config, { autoPlay: true, moveDelayMs: 450 });
  const { game } = match.view;
  const humanToMove = !game.over() && match.toMoveKind === "human" ? match.toMove : null;

  const newGame = (changes: Partial<{ n: number; human: Colour; opponent: Opponent }> = {}) => {
    if (changes.n !== undefined) setN(changes.n);
    if (changes.human !== undefined) setHuman(changes.human);
    if (changes.opponent !== undefined) setOpponent(changes.opponent);
    setSeed(randomSeed());
    setSelected(null);
    match.reset();
  };

  const lastExplained = Object.keys(match.meta)
    .map(Number)
    .sort((a, b) => b - a)[0];
  const shown = selected !== null && match.meta[selected] ? selected : lastExplained;

  const status = (
    <MatchStatus
      game={game}
      kinds={config}
      thinking={match.thinking}
      error={match.error}
      perspective={human}
    />
  );

  return (
    <div className="table-felt">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="mb-6 max-w-2xl">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            Play vs AI
          </p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Take on agent _4399</h1>
          <p className="text-muted-foreground mt-2">
            The opponent is a faithful TypeScript port of our Python minimax agent, running in a Web
            Worker. Red moves first; Blue may steal Red&apos;s opening tile.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="lg:hidden">{status}</div>
            <div className="bg-card/40 rounded-3xl border p-2 sm:p-6">
              <MatchBoard
                n={n}
                view={match.view}
                moveCount={match.actions.length}
                humanColour={humanToMove}
                onPlace={(r, q) => match.play(place(r, q))}
                showCoords={showCoords}
                className="lg:max-h-[calc(100svh-17rem)]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={match.undo} disabled={!match.canUndo}>
                <Undo2 /> Undo
              </Button>
              <Button variant="outline" onClick={() => newGame()}>
                <RotateCcw /> New game
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Switch id="coords" checked={showCoords} onCheckedChange={setShowCoords} />
                <Label htmlFor="coords" className="text-muted-foreground text-sm">
                  Show coordinates
                </Label>
              </div>
            </div>
            <BoardLegend />
          </div>

          <aside className="space-y-4" aria-label="Match controls">
            <div className="hidden lg:block">{status}</div>

            {humanToMove === "blue" && game.canSteal() && (
              <div className="border-blue-player/40 bg-blue-player-soft rounded-2xl border p-4">
                <p className="text-sm">
                  <span className="font-medium">Steal?</span> As Blue&apos;s first move you can take
                  Red&apos;s tile: it is mirrored across the long diagonal and becomes yours.
                </p>
                <Button className="mt-3" size="sm" onClick={() => match.play(STEAL)}>
                  <ArrowLeftRight /> Steal Red&apos;s tile
                </Button>
              </div>
            )}

            <Panel title="Match setup">
              <div className="space-y-4">
                <Field
                  label="Board size"
                  htmlFor="board-size"
                  hint="Changing a setting starts a new game."
                >
                  <BoardSizeSelect id="board-size" value={n} onChange={(v) => newGame({ n: v })} />
                </Field>
                <Field label="You play">
                  <Segmented
                    label="Your colour"
                    value={human}
                    onChange={(v) => newGame({ human: v })}
                    options={[
                      {
                        value: "red",
                        label: (
                          <>
                            <ColourDot colour="red" /> Red (first)
                          </>
                        ),
                      },
                      {
                        value: "blue",
                        label: (
                          <>
                            <ColourDot colour="blue" /> Blue
                          </>
                        ),
                      },
                    ]}
                  />
                </Field>
                <Field label="Opponent">
                  <Segmented
                    label="Opponent"
                    value={opponent}
                    onChange={(v) => newGame({ opponent: v })}
                    options={[
                      { value: "minimax", label: "Minimax agent" },
                      { value: "random", label: "Random agent" },
                    ]}
                  />
                </Field>
              </div>
            </Panel>

            <Panel title="Why that move?">
              <ExplainPanel
                meta={shown !== undefined ? match.meta[shown] : undefined}
                action={shown !== undefined ? match.actions[shown] : undefined}
                colour={shown !== undefined ? (shown % 2 === 0 ? "red" : "blue") : undefined}
                turn={shown !== undefined ? shown + 1 : undefined}
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
