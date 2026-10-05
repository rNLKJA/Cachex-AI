"use client";

import { Download, KeyRound, Loader2, Play, Square } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { HexBoard } from "@/components/board/hex-board";
import { Field, Panel, Segmented } from "@/components/play/primitives";
import { EstimateCI, IntervalAxis, IntervalBar } from "@/components/stats/interval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollRegion, ScrollTable } from "@/components/stats/scroll-table";
import { useAgentWorker } from "@/hooks/use-agent-worker";
import { callStructured } from "@/lib/ai/client";
import {
  type FormatFailure,
  LLM_PLAYER_MAX_TOKENS,
  type LlmGameRecord,
  LlmMoveSchema,
  type PairedWithLlm,
  type ScheduledGame,
  completedSchedule,
  llmGamesCsvRows,
  pairWithLlm,
  playLlmGame,
  scheduleGames,
  summariseBaseline,
  summariseLlmGames,
} from "@/lib/ai/llm-player";
import { type AiErrorKind, isAiError } from "@/lib/ai/types";
import { Game } from "@/lib/cachex/game";
import type { Action, Colour } from "@/lib/cachex/types";
import { toCsv } from "@/lib/csv";
import { downloadText } from "@/lib/download";
import { formatNumber, formatPStatement, formatPct } from "@/lib/stats/format";
import type { ClusteredProportionCI, ProportionCI } from "@/lib/stats/proportion";
import { AiBadge } from "./ai-badge";
import { useAi } from "./ai-provider";

const formatLatency = (ms: number) =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${formatNumber(ms / 1000, 1)} s`;

/** How the clustered interval was made, in a few words. */
const designEffectNote = (r: ClusteredProportionCI) =>
  Number.isFinite(r.designEffect)
    ? `design effect ${formatNumber(Math.max(1, r.designEffect), 2)} over ${r.clusters} games`
    : r.clusters < 2
      ? "one game: turns treated as independent"
      : r.successes === 0 || r.successes === r.n
        ? "no spread between games to estimate a design effect"
        : "design effect not estimable";

const pctCI = (lo: number, hi: number) => `[${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]`;

type Live = {
  game: number;
  llmColour: Colour;
  actions: Action[];
  waiting: "llm" | "agent";
  lastReason: string | null;
};

type Status = { kind: "idle" } | { kind: "running" } | { kind: "done"; stopped: string | null };

/**
 * Provider errors that mean "no usable move in this answer". They are counted
 * as format failures for the model (the same rule for every provider) and the
 * game goes on; anything else (key, rate limit, network) stops the run.
 */
const FORMAT_FAILURES: Partial<Record<AiErrorKind, FormatFailure>> = {
  "invalid-output": "malformed",
  truncated: "truncated",
  refusal: "refusal",
};

const BASELINES = [
  { id: "random", label: "Random baseline" },
  { id: "greedy", label: "Greedy one-ply baseline" },
  { id: "first-legal", label: "First legal cell (scripted)" },
] as const;

export function LlmArenaClient() {
  const { credentials, ready, openSettings, audit } = useAi();
  const requestAgent = useAgentWorker();
  const [count, setCount] = useState("4");
  const [n, setN] = useState("4");
  const [seedText, setSeedText] = useState("2026");
  const [records, setRecords] = useState<LlmGameRecord[]>([]);
  const [live, setLive] = useState<Live | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [ran, setRan] = useState<{ n: number; schedule: ScheduledGame[]; model: string } | null>(
    null,
  );
  const abort = useRef<AbortController | null>(null);

  const seed = Number.parseInt(seedText, 10) || 0;
  const size = Number(n);
  const schedule = useMemo(() => scheduleGames(Number(count), seed), [count, seed]);

  const run = async () => {
    if (!credentials) return openSettings();
    const controller = new AbortController();
    abort.current = controller;
    setRecords([]);
    setRan({ n: size, schedule, model: credentials.model });
    setStatus({ kind: "running" });
    const done: LlmGameRecord[] = [];
    let stopped: string | null = null;

    const agentMove = async (history: readonly Action[], colour: Colour, moveSeed: number) => {
      setLive((l) => (l ? { ...l, waiting: "agent" } : l));
      const res = await requestAgent({
        kind: "minimax",
        n: size,
        history: [...history],
        colour,
        seed: moveSeed,
      });
      if (!res.ok) throw new Error(res.error);
      return res.decision.action;
    };

    for (const g of schedule) {
      setLive({
        game: g.index,
        llmColour: g.llmColour,
        actions: [],
        waiting: "agent",
        lastReason: null,
      });
      try {
        const record = await playLlmGame({
          n: size,
          game: g,
          signal: controller.signal,
          agentMove,
          onMove: (history) => setLive((l) => (l ? { ...l, actions: [...history] } : l)),
          askLlm: async (prompt, meta) => {
            setLive((l) => (l ? { ...l, waiting: "llm" } : l));
            const started = performance.now();
            try {
              const res = await callStructured(
                credentials,
                {
                  feature: "llm-player",
                  ...prompt,
                  schema: LlmMoveSchema,
                  schemaName: "cachex_move",
                  maxTokens: LLM_PLAYER_MAX_TOKENS,
                },
                {
                  audit,
                  signal: controller.signal,
                  humanDecision: "not-applicable",
                  context: {
                    game: g.index + 1,
                    seed: g.seed,
                    boardSize: size,
                    llmColour: g.llmColour,
                    turn: meta.turn,
                    attempt: meta.attempt,
                  },
                },
              );
              setLive((l) => (l ? { ...l, lastReason: res.data.reason } : l));
              return { move: res.data, latencyMs: res.entry.latencyMs, usage: res.usage };
            } catch (err) {
              // No usable move in the reply: a format failure for the model, not a crash.
              const failure = isAiError(err) ? FORMAT_FAILURES[err.kind] : undefined;
              if (isAiError(err) && failure) {
                return {
                  move: null,
                  failure,
                  latencyMs: performance.now() - started,
                  usage: err.usage,
                };
              }
              throw err;
            }
          },
        });
        done.push(record);
        setRecords([...done]);
      } catch (err) {
        stopped =
          err instanceof DOMException && err.name === "AbortError"
            ? "Stopped by you."
            : isAiError(err)
              ? err.kind === "aborted"
                ? "Stopped by you."
                : err.message
              : String(err);
        break;
      }
    }
    setLive(null);
    setStatus({ kind: "done", stopped });
  };

  const summary = records.length ? summariseLlmGames(records) : null;
  // Before a run, the baselines preview the planned schedule. Once a run has
  // started, they cover only the games the model finished, so every row is
  // always on the same seeds and colours (a stop or an error mid-run included).
  const compared = useMemo(
    () => (ran ? completedSchedule(ran.schedule, records) : schedule),
    [ran, records, schedule],
  );
  const comparedN = ran?.n ?? size;
  const baselines = useMemo(
    () =>
      BASELINES.map((b) => {
        const summary = summariseBaseline(comparedN, compared, b.id);
        return {
          ...b,
          summary,
          paired: summary && records.length ? pairWithLlm(records, summary) : null,
        };
      }),
    [compared, comparedN, records],
  );
  const scheduled = ran?.schedule.length ?? schedule.length;
  const asRed = compared.filter((g) => g.llmColour === "red").length;
  const asBlue = compared.length - asRed;

  const liveGame = live ? Game.fromActions(ran?.n ?? size, live.actions) : null;
  const cells = liveGame
    ? Array.from({ length: liveGame.n * liveGame.n }, (_, i) =>
        liveGame.board.get(Math.floor(i / liveGame.n), i % liveGame.n),
      )
    : null;

  const exportCsv = () => {
    if (!summary || !ran) return;
    const perGame = toCsv(llmGamesCsvRows(records));
    downloadText(`llm-vs-minimax-${ran.model}-seed-${seed}.csv`, perGame);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel title="Evaluation setup">
          <div className="space-y-4">
            <Field label="Games" hint="Colours alternate, so half are played as Red.">
              <Segmented
                label="Number of games"
                value={count}
                onChange={setCount}
                disabled={status.kind === "running"}
                options={["2", "4", "6", "8"].map((v) => ({ value: v, label: v }))}
              />
            </Field>
            <Field label="Board">
              <Segmented
                label="Board size"
                value={n}
                onChange={setN}
                disabled={status.kind === "running"}
                options={[
                  { value: "4", label: "4 × 4" },
                  { value: "5", label: "5 × 5" },
                ]}
              />
            </Field>
            <Field
              label="Seed"
              htmlFor="llm-seed"
              hint="Drives the minimax opponent's move shuffle and tie-breaks."
            >
              <Input
                id="llm-seed"
                inputMode="numeric"
                value={seedText}
                disabled={status.kind === "running"}
                onChange={(e) => setSeedText(e.target.value)}
              />
            </Field>
            {!ready ? null : credentials ? (
              <p className="text-muted-foreground text-xs">
                Model: <span className="text-foreground font-mono">{credentials.model}</span> (
                {credentials.provider}). Each answer is one API call billed to your key; a game
                takes about {(size * size) / 2} calls. A rejected answer (an illegal move, or a
                reply with no usable move) is retried up to 3 times, then the game is forfeited.
              </p>
            ) : (
              <p className="bg-muted/50 rounded-xl border p-3 text-sm">
                This evaluation needs your own API key. Nothing is sent anywhere until you add one.
              </p>
            )}
            {status.kind === "running" ? (
              <Button variant="outline" className="w-full" onClick={() => abort.current?.abort()}>
                <Square /> Stop
              </Button>
            ) : (
              <Button className="w-full" onClick={run} disabled={!ready}>
                {credentials ? <Play /> : <KeyRound />}{" "}
                {credentials ? `Play ${count} games` : "Add a key to play"}
              </Button>
            )}
          </div>
        </Panel>
        {live && cells && liveGame && (
          <Panel title={`Game ${live.game + 1} of ${schedule.length}`}>
            <HexBoard
              n={liveGame.n}
              cells={cells}
              lastMove={null}
              label={`Live board for game ${live.game + 1}`}
            />
            <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs" role="status">
              <Loader2 className="size-3.5 animate-spin" />
              The model plays {live.llmColour === "red" ? "Red" : "Blue"} · turn{" "}
              {live.actions.length + 1} ·{" "}
              {live.waiting === "llm" ? "waiting for the model" : "minimax agent thinking"}
            </p>
            {live.lastReason && (
              <div className="mt-2 space-y-1">
                <AiBadge model={ran?.model} />
                <p className="text-sm">&ldquo;{live.lastReason}&rdquo;</p>
              </div>
            )}
          </Panel>
        )}
      </div>

      <div className="min-w-0 space-y-6">
        {status.kind === "done" && status.stopped && (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/10 rounded-xl border p-4 text-sm"
          >
            {status.stopped}{" "}
            {records.length > 0 &&
              `Results below cover the ${records.length} completed game${records.length === 1 ? "" : "s"}.`}
          </p>
        )}

        <section aria-labelledby="side-by-side" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="side-by-side" className="text-xl font-semibold">
              Side by side against the original agent
            </h2>
            {summary && (
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download /> Per-game CSV
              </Button>
            )}
          </div>
          <ScrollTable
            className="min-w-[760px]"
            caption={
              <>
                {ran && compared.length < scheduled ? (
                  <>
                    Same {compared.length} of {scheduled} scheduled seeds and colours for every row
                    (the games the model finished)
                  </>
                ) : (
                  <>Same {compared.length} seeds and colours for every row</>
                )}
                , on {comparedN} × {comparedN}; the opponent is always the original minimax agent.
                {asRed !== asBlue && (
                  <>
                    {" "}
                    Colours are unbalanced ({asRed} as Red, {asBlue} as Blue), so the first-move
                    effect does not cancel.
                  </>
                )}{" "}
                Baselines are computed in your browser. Win rates: Wilson 95% intervals, wide with a
                handful of games, which is the honest answer. The paired column compares each
                baseline with the model game by game: only games exactly one of them won count, with
                an exact McNemar test (with 4 games it can only detect a very large difference).
                Turns within a game are not independent, so the rejected-answer interval is a Wilson
                interval on the effective number of turns, after a design effect estimated from how
                much the rate varies between games (never below 1). The scripted baseline plays the
                first empty cell in (r, q) order; as Blue that line wins unless Red blocks it, so a
                model that beats the agent should also beat this row.
              </>
            }
          >
            <thead className="text-muted-foreground text-left text-xs">
              <tr className="border-b">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Player in the seat
                </th>
                <th scope="col" className="w-[24%] py-2 pr-3 font-medium">
                  <span className="sr-only">Win rate interval</span>
                  <IntervalAxis min={0} max={1} ticks={[0, 0.5, 1]} format={(t) => `${t * 100}%`} />
                </th>
                <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">
                  Win rate (95% CI)
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  First answer rejected
                  <span className="block font-normal">per turn (95% CI, clustered by game)</span>
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Paired with the LLM
                  <span className="block font-normal">same games, exact McNemar</span>
                </th>
                <th scope="col" className="py-2 text-right font-medium whitespace-nowrap">
                  Latency · tokens
                </th>
              </tr>
            </thead>
            <tbody>
              <Row
                label={ran ? `LLM: ${ran.model}` : "LLM (your key)"}
                badge
                ci={summary?.wins ?? null}
                extra={
                  summary
                    ? `${summary.forfeits} forfeit${summary.forfeits === 1 ? "" : "s"} · ${summary.turns} turn${summary.turns === 1 ? "" : "s"}`
                    : "not run yet"
                }
                illegal={summary?.firstAnswerRejected ?? null}
                illegalDetail={
                  summary
                    ? `${summary.firstAnswerIllegal} illegal move${summary.firstAnswerIllegal === 1 ? "" : "s"} · ${summary.firstAnswerFormat} with no usable move · ${designEffectNote(summary.firstAnswerRejected)}`
                    : undefined
                }
                illegalNote="–"
                paired={null}
                pairedNote="–"
                perf={
                  summary
                    ? `${formatLatency(summary.meanLatencyMs)}/answer · ${summary.meanInputTokens === null ? "–" : `${formatNumber(summary.meanInputTokens, 0)} in / ${formatNumber(summary.meanOutputTokens ?? 0, 0)} out`}`
                    : "–"
                }
              />
              {baselines.map((b) => (
                <Row
                  key={b.id}
                  label={b.label}
                  ci={b.summary?.wins ?? null}
                  extra={
                    b.summary
                      ? `${b.summary.draws} draw${b.summary.draws === 1 ? "" : "s"}`
                      : "waiting for the first finished game"
                  }
                  illegal={null}
                  paired={b.paired}
                  pairedNote={summary ? "–" : "after a run"}
                  perf="instant"
                />
              ))}
            </tbody>
          </ScrollTable>
        </section>

        {records.length > 0 && (
          <section aria-labelledby="per-game" className="space-y-3">
            <h2 id="per-game" className="text-xl font-semibold">
              Games
            </h2>
            <ScrollRegion label="Games played by the model">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr className="border-b">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Game
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Model plays
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Result
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Turns
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Answers (rejected)
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Rejected answers
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.index} className="border-border/50 border-b align-top last:border-0">
                      <td className="py-2 pr-3 font-mono">{r.index + 1}</td>
                      <td className="py-2 pr-3 capitalize">{r.llmColour}</td>
                      <td className="py-2 pr-3 capitalize">{r.result}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{r.turns}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {r.attempts} ({r.attempts - r.llmMoves})
                      </td>
                      <td className="text-muted-foreground py-2 text-xs">
                        {r.rejections.length ? r.rejections.join("; ") : "none"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
            <p className="text-muted-foreground text-xs">
              Every model call (prompt, reply, latency, tokens) is in the{" "}
              <Link href="/ai-log" className="underline underline-offset-4">
                AI audit log
              </Link>
              , marked as an automated evaluation.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  badge = false,
  ci,
  extra,
  illegal,
  illegalDetail,
  illegalNote = "0 by construction",
  paired,
  pairedNote,
  perf,
}: {
  label: string;
  badge?: boolean;
  ci: ProportionCI | null;
  extra: string;
  illegal: ClusteredProportionCI | null;
  illegalDetail?: string;
  illegalNote?: string;
  paired: PairedWithLlm | null;
  pairedNote: string;
  perf: string;
}) {
  return (
    <tr className="border-border/50 border-b last:border-0">
      <th scope="row" className="py-2 pr-3 text-left font-normal">
        <span className="font-medium">{label}</span>
        {badge && ci && <AiBadge className="ml-2" />}
        <span className="text-muted-foreground block text-xs">{extra}</span>
      </th>
      <td className="py-2 pr-3">
        {ci && (
          <IntervalBar
            estimate={ci.p}
            lower={ci.lower}
            upper={ci.upper}
            min={0}
            max={1}
            reference={0.5}
            label={`${label}: ${ci.successes} wins of ${ci.n}, 95% CI ${formatPct(ci.lower)} to ${formatPct(ci.upper)}`}
          />
        )}
      </td>
      <td className="py-2 pr-3">
        {ci ? (
          <EstimateCI estimate={`${ci.successes}/${ci.n}`} interval={pctCI(ci.lower, ci.upper)} />
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </td>
      <td className="py-2 pr-3">
        {illegal ? (
          <>
            <EstimateCI
              estimate={`${illegal.successes}/${illegal.n}`}
              interval={pctCI(illegal.lower, illegal.upper)}
            />
            {illegalDetail && (
              <span className="text-muted-foreground block text-xs">{illegalDetail}</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground text-xs">{illegalNote}</span>
        )}
      </td>
      <td className="py-2 pr-3 text-xs">
        {paired ? (
          <>
            <span className="font-mono tabular-nums">
              {paired.llmOnly} vs {paired.baselineOnly}
            </span>
            <span className="text-muted-foreground block">
              won by the LLM only vs this row only, of {paired.games};{" "}
              {formatPStatement(paired.mcnemar.pValue)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{pairedNote}</span>
        )}
      </td>
      <td className="py-2 text-right font-mono text-xs whitespace-nowrap">{perf}</td>
    </tr>
  );
}
