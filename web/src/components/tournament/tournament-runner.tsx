"use client";

import { Download, Loader2, Play, Shuffle, Square } from "lucide-react";
import { useMemo, useState } from "react";

import { Field, Panel } from "@/components/play/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTournamentPool } from "@/hooks/use-tournament-pool";
import { downloadText } from "@/lib/download";
import { randomSeed } from "@/lib/rng";
import { AGENT_IDS, AGENTS, type AgentId } from "@/lib/tournament/agents";
import { gamesCsv, summariseTournament, summaryCsv } from "@/lib/tournament/analyse";
import type { GameRecord } from "@/lib/tournament/play";
import { buildSchedule } from "@/lib/tournament/schedule";
import { EloDifferenceTable, Leaderboard, PairwiseTable, SummaryStats } from "./tournament-results";

const SIZES = [3, 4, 5, 6, 7];
const ROUNDS = [1, 2, 5, 10, 20];

type Status =
  | { kind: "idle" }
  | { kind: "running"; total: number; started: number }
  | { kind: "done"; elapsedMs: number; cancelled: boolean }
  | { kind: "error"; message: string };

export function TournamentRunner() {
  const [agents, setAgents] = useState<AgentId[]>([
    "minimax-dynamic",
    "minimax-d2",
    "greedy",
    "random",
  ]);
  const [sizes, setSizes] = useState<number[]>([4, 5]);
  const [rounds, setRounds] = useState(5);
  const [seed, setSeed] = useState(4399);
  const [seedText, setSeedText] = useState("4399");
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [ranSeed, setRanSeed] = useState(seed);
  const pool = useTournamentPool();

  const running = status.kind === "running";
  const games =
    agents.length >= 2 && sizes.length
      ? ((agents.length * (agents.length - 1)) / 2) * sizes.length * rounds * 2
      : 0;
  const slow = agents.includes("minimax-d3") && sizes.some((n) => n >= 6);
  const tooBig = agents.some((a) => sizes.some((n) => n > AGENTS[a].maxLiveN));

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const start = async () => {
    const schedule = buildSchedule({ agents, sizes, rounds, seed });
    setRecords([]);
    setRanSeed(seed);
    const started = performance.now();
    setStatus({ kind: "running", total: schedule.length, started });
    const collected: GameRecord[] = [];
    try {
      const outcome = await pool.run(schedule, (r) => {
        collected.push(r);
        setRecords([...collected]);
      });
      setStatus({
        kind: "done",
        elapsedMs: performance.now() - started,
        cancelled: outcome === "cancelled",
      });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const summary = useMemo(
    () =>
      status.kind === "done" && records.length > 0
        ? summariseTournament(records, { reps: 500, seed: ranSeed })
        : null,
    [records, ranSeed, status.kind],
  );

  const stamp = `seed-${ranSeed}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Panel title="Set up a round robin" className="lg:self-start">
        <div className="space-y-4">
          <fieldset className="space-y-2" disabled={running}>
            <legend className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              Agents
            </legend>
            {AGENT_IDS.map((id) => (
              <div key={id} className="flex items-start gap-2">
                <Checkbox
                  id={`agent-${id}`}
                  checked={agents.includes(id)}
                  onCheckedChange={() => setAgents((a) => toggle(a, id))}
                  className="mt-0.5"
                />
                <Label htmlFor={`agent-${id}`} className="block text-sm leading-snug font-normal">
                  {AGENTS[id].label}
                  <span className="text-muted-foreground block text-xs">{AGENTS[id].knob}</span>
                </Label>
              </div>
            ))}
          </fieldset>

          <fieldset disabled={running}>
            <legend className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
              Board sizes
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={sizes.includes(n)}
                  onClick={() => setSizes((s) => toggle(s, n))}
                  className="aria-pressed:border-gold/60 aria-pressed:bg-gold/15 font-mono aria-pressed:font-semibold"
                >
                  {n}×{n}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset disabled={running}>
            <legend className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
              Colour-swapped pairs per pairing and size
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {ROUNDS.map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={rounds === r}
                  onClick={() => setRounds(r)}
                  className="aria-pressed:border-gold/60 aria-pressed:bg-gold/15 font-mono aria-pressed:font-semibold"
                >
                  {r}
                </Button>
              ))}
            </div>
          </fieldset>

          <Field label="Seed" htmlFor="tournament-seed">
            <div className="flex gap-2">
              <Input
                id="tournament-seed"
                inputMode="numeric"
                value={seedText}
                disabled={running}
                onChange={(e) => {
                  setSeedText(e.target.value);
                  const v = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v >= 0) setSeed(v);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={running}
                aria-label="Random seed"
                onClick={() => {
                  const s = randomSeed();
                  setSeed(s);
                  setSeedText(String(s));
                }}
              >
                <Shuffle />
              </Button>
            </div>
          </Field>

          <p className="text-muted-foreground text-xs">
            {games.toLocaleString("en-AU")} games, played in parallel Web Workers.
            {slow && " Depth 3 on 6 × 6 and above takes a few seconds per game."}
            {tooBig && " Some agents are slow at the larger sizes selected."}
          </p>

          {running ? (
            <Button variant="outline" className="w-full" onClick={pool.stop}>
              <Square /> Stop
            </Button>
          ) : (
            <Button className="w-full" onClick={start} disabled={games === 0}>
              <Play /> Run {games.toLocaleString("en-AU")} games
            </Button>
          )}
        </div>
      </Panel>

      <div className="min-w-0 space-y-6">
        {status.kind === "idle" && (
          <div className="text-muted-foreground flex min-h-56 items-center justify-center rounded-2xl border border-dashed px-6 text-center text-sm">
            Choose agents and board sizes, then run. Every game is reproducible from the seed; each
            pairing plays the same seed twice with colours swapped.
          </div>
        )}
        {status.kind === "running" && (
          <div className="rounded-2xl border p-5" role="status" aria-live="polite">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Played {records.length} of {status.total}{" "}
              games…
            </div>
            <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width]"
                style={{ width: `${(records.length / status.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {status.kind === "error" && (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/10 rounded-xl border p-4 text-sm"
          >
            {status.message}
          </p>
        )}
        {summary && status.kind === "done" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted-foreground mr-auto text-xs">
                {status.cancelled ? "Stopped early: " : ""}
                {records.length} games in {(status.elapsedMs / 1000).toFixed(1)} s · seed {ranSeed}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadText(`cachex-tournament-games-${stamp}.csv`, gamesCsv(records))
                }
              >
                <Download /> Games CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadText(`cachex-tournament-summary-${stamp}.csv`, summaryCsv(summary))
                }
              >
                <Download /> Summary CSV
              </Button>
            </div>
            <SummaryStats summary={summary} />
            <Leaderboard
              summary={summary}
              caption={`Your run: Bradley-Terry strengths on the Elo scale (${summary.anchor ? "random fixed at 0" : "centred on the mean of the agents you picked, because random is not included"}) with bootstrap 95% intervals; Wilson intervals for win rates. Move times are from this browser.`}
            />
            <PairwiseTable summary={summary} />
            <EloDifferenceTable summary={summary} />
          </>
        )}
      </div>
    </div>
  );
}
