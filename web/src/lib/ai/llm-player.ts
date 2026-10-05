/**
 * "LLM as a player": an evaluation harness in which a language model plays
 * short games of Cachex against the original minimax agent.
 *
 * The model sees the rules, the board, the move history and the full list of
 * legal moves, and must answer with structured JSON. Every answer is checked
 * against the referee and classified the same way for every provider:
 *
 *  - an illegal move: well-formed JSON naming a move the rules do not allow;
 *  - a format failure: no usable move at all (JSON that does not match the
 *    schema, a reply cut off at the token limit, or a refusal).
 *
 * Either way the model is asked again (with the reason), up to `maxAttempts`;
 * after that it forfeits the game. The headline rate is per turn: the share
 * of the model's turns whose first answer was rejected, because retries on
 * the same turn are not independent trials. Turns within a game are not
 * independent either (same model, prompt and evolving position), so its
 * Wilson interval uses the effective number of turns after a design effect
 * estimated from how much the rate varies between games. Colours alternate so the model
 * plays as many games as Red as it does as Blue, and the same schedule (seeds
 * and colours) is replayed with baseline players in the model's seat, giving
 * a side-by-side comparison on identical conditions.
 */
import { z } from "zod";

import { Game } from "@/lib/cachex/game";
import { type Action, type Colour, STEAL, formatAction, opponent, place } from "@/lib/cachex/types";
import { deriveSeed } from "@/lib/rng";
import { median } from "@/lib/stats/descriptive";
import { type McNemarResult, mcnemarExact } from "@/lib/stats/mcnemar";
import {
  type ClusteredProportionCI,
  type ProportionCI,
  clusteredWilson,
  wilson,
} from "@/lib/stats/proportion";
import { type AgentId } from "@/lib/tournament/agents";
import { defaultTournamentMove, playTournamentGame } from "@/lib/tournament/play";
import type { TokenUsage } from "./types";

export const LlmMoveSchema = z.object({
  action: z.enum(["PLACE", "STEAL"]),
  r: z.number().int().describe("Row of the cell for PLACE; use -1 for STEAL."),
  q: z.number().int().describe("Column of the cell for PLACE; use -1 for STEAL."),
  reason: z.string().describe("One short sentence."),
});

export type LlmMove = z.infer<typeof LlmMoveSchema>;

export const LLM_PLAYER_SYSTEM = `You are playing the board game Cachex. Reply with one move as JSON.

Rules:
- The board is n by n cells with coordinates (r, q), 0 <= r, q < n.
- The neighbours of (r, q) are (r+1, q-1), (r+1, q), (r, q+1), (r-1, q+1), (r-1, q) and (r, q-1), when they are on the board.
- Red moves first. Players alternate placing one tile on an empty cell.
- Red wins by connecting row r = 0 to row r = n-1 with a chain of neighbouring red tiles. Blue wins by connecting column q = 0 to column q = n-1 with blue tiles.
- Capture: if your new tile completes a diamond (your tile, two enemy tiles that are neighbours of each other and of your tile, and another of your tiles opposite), the two enemy tiles are removed.
- On Blue's first move only, Blue may STEAL: Red's tile is removed and replaced by a Blue tile at the mirrored cell (q, r).
- On the very first move of the game, the centre cell of an odd-sized board is not allowed.

You must choose exactly one move from the list of legal moves you are given.`;

/**
 * Text board. Cells are two characters wide and each row is shifted right by
 * one character (half a cell), so the neighbours (r+1, q-1) and (r+1, q) sit
 * symmetrically below-left and below-right of (r, q), as on the real board.
 */
export function renderBoard(game: Game): string {
  const n = game.n;
  const lines: string[] = [];
  lines.push(`q:   ${Array.from({ length: n }, (_, q) => String(q).padEnd(2)).join("")}`.trimEnd());
  for (let r = 0; r < n; r++) {
    const row = Array.from({ length: n }, (_, q) => {
      const c = game.board.get(r, q);
      return c === "red" ? "R" : c === "blue" ? "B" : ".";
    }).join(" ");
    lines.push(`r${String(r).padEnd(3)} ${" ".repeat(r)}${row}`);
  }
  return lines.join("\n");
}

export function legalMoves(game: Game): Action[] {
  const moves: Action[] = game.legalPlacements().map(([r, q]) => place(r, q));
  if (game.canSteal()) moves.push(STEAL);
  return moves;
}

const label = (a: Action) => (a[0] === "STEAL" ? "STEAL" : `(${a[1]}, ${a[2]})`);

export function buildMovePrompt(
  n: number,
  history: readonly Action[],
  colour: Colour,
  feedback?: string,
): { system: string; user: string } {
  const game = Game.fromActions(n, history);
  const moves = legalMoves(game);
  const historyText = history.length
    ? history
        .map((a, i) => `${i + 1}. ${i % 2 === 0 ? "Red" : "Blue"} ${formatAction(a)}`)
        .join("\n")
    : "(no moves yet)";
  const user = [
    `Board size n = ${n}. You are ${colour === "red" ? "Red" : "Blue"} (${colour === "red" ? "connect row 0 to row " + (n - 1) : "connect column 0 to column " + (n - 1)}). It is turn ${history.length + 1}.`,
    "",
    "Board (R = red, B = blue, . = empty; each row is shifted half a cell to show the hex layout):",
    renderBoard(game),
    "",
    "Moves so far:",
    historyText,
    "",
    `Legal moves (${moves.length}): ${moves.map(label).join(", ")}`,
    "",
    'Answer with {"action": "PLACE", "r": <row>, "q": <column>, "reason": "..."} or {"action": "STEAL", "r": -1, "q": -1, "reason": "..."}.',
    feedback
      ? `\nYour previous answer was rejected: ${feedback} Choose again from the legal moves.`
      : "",
  ].join("\n");
  return { system: LLM_PLAYER_SYSTEM, user };
}

export type MoveCheck = { ok: true; action: Action } | { ok: false; reason: string };

/** Check a structured answer against the referee's rules for the current position. */
export function validateMove(n: number, history: readonly Action[], move: LlmMove): MoveCheck {
  const game = Game.fromActions(n, history);
  if (move.action === "STEAL") {
    return game.canSteal()
      ? { ok: true, action: STEAL }
      : { ok: false, reason: "STEAL is only legal as Blue's first move." };
  }
  const action = place(move.r, move.q);
  if (!game.board.insideBounds(move.r, move.q)) {
    return { ok: false, reason: `(${move.r}, ${move.q}) is outside the board.` };
  }
  if (game.board.isOccupied(move.r, move.q)) {
    return { ok: false, reason: `(${move.r}, ${move.q}) is already occupied.` };
  }
  if (!game.isLegal(action)) {
    return { ok: false, reason: `(${move.r}, ${move.q}) is not a legal move here.` };
  }
  return { ok: true, action };
}

/** Why an answer carried no usable move. */
export type FormatFailure = "malformed" | "truncated" | "refusal";

export const FORMAT_FAILURE_REASON: Record<FormatFailure, string> = {
  malformed: "The reply did not match the move format.",
  truncated: "The reply was cut off at the token limit.",
  refusal: "The model declined to answer.",
};

export interface LlmCallResult {
  /** null when the reply carried no usable move (see `failure`). */
  move: LlmMove | null;
  /** Why `move` is null; treated as "malformed" when absent. */
  failure?: FormatFailure;
  latencyMs: number;
  usage: TokenUsage | null;
}

/**
 * Output-token budget per answer, the same for both providers. Generous for a
 * one-line JSON move so that a reasoning model's thinking rarely hits it; a
 * reply that does is recorded as "truncated" (a format failure), not as an
 * illegal move.
 */
export const LLM_PLAYER_MAX_TOKENS = 4096;

export interface ScheduledGame {
  index: number;
  llmColour: Colour;
  seed: number;
}

/** Colour-balanced schedule: game i has the model as Red when i is even. */
export function scheduleGames(count: number, seed: number): ScheduledGame[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    llmColour: index % 2 === 0 ? "red" : "blue",
    // Each colour-swapped pair shares a seed, like the tournament.
    seed: deriveSeed(seed, Math.floor(index / 2)),
  }));
}

export interface LlmGameRecord extends ScheduledGame {
  n: number;
  result: "win" | "loss" | "draw" | "forfeit";
  winner: Colour | null;
  turns: number;
  actions: Action[];
  llmMoves: number;
  /** Turns on which the model was asked for a move (including a forfeited one). */
  llmTurns: number;
  /** Turns whose first answer was a well-formed but illegal move. */
  firstAnswerIllegal: number;
  /** Turns whose first answer carried no usable move. */
  firstAnswerFormat: number;
  /** All answers, retries included. */
  attempts: number;
  /** Answers naming an illegal move. */
  illegalAttempts: number;
  /** Answers with no usable move, by kind. */
  formatFailures: Record<FormatFailure, number>;
  rejections: string[];
  latencyMs: number[];
  inputTokens: number;
  outputTokens: number;
  usageReported: boolean;
}

export interface PlayLlmGameOptions {
  n: number;
  game: ScheduledGame;
  /** Calls the model (and logs the call). Throwing aborts the evaluation. */
  askLlm: (
    prompt: { system: string; user: string },
    meta: { turn: number; attempt: number },
  ) => Promise<LlmCallResult>;
  /** The opponent's move (the minimax agent, normally in a Web Worker). */
  agentMove: (history: readonly Action[], colour: Colour, seed: number) => Promise<Action>;
  maxAttempts?: number;
  signal?: AbortSignal;
  onMove?: (history: readonly Action[]) => void;
}

export async function playLlmGame({
  n,
  game: scheduled,
  askLlm,
  agentMove,
  maxAttempts = 3,
  signal,
  onMove,
}: PlayLlmGameOptions): Promise<LlmGameRecord> {
  const game = new Game(n);
  const history: Action[] = [];
  const record: LlmGameRecord = {
    ...scheduled,
    n,
    result: "draw",
    winner: null,
    turns: 0,
    actions: history,
    llmMoves: 0,
    llmTurns: 0,
    firstAnswerIllegal: 0,
    firstAnswerFormat: 0,
    attempts: 0,
    illegalAttempts: 0,
    formatFailures: { malformed: 0, truncated: 0, refusal: 0 },
    rejections: [],
    latencyMs: [],
    inputTokens: 0,
    outputTokens: 0,
    usageReported: false,
  };

  while (!game.over()) {
    if (signal?.aborted) throw new DOMException("Evaluation cancelled", "AbortError");
    const colour = game.turnPlayer();
    if (colour !== scheduled.llmColour) {
      const action = await agentMove(history, colour, deriveSeed(scheduled.seed, history.length));
      game.update(colour, action);
      history.push(action);
      onMove?.(history);
      continue;
    }

    let chosen: Action | null = null;
    let feedback: string | undefined;
    record.llmTurns += 1;
    for (let attempt = 1; attempt <= maxAttempts && chosen === null; attempt++) {
      const prompt = buildMovePrompt(n, history, colour, feedback);
      const res = await askLlm(prompt, { turn: history.length + 1, attempt });
      record.attempts += 1;
      record.latencyMs.push(res.latencyMs);
      if (res.usage) {
        record.usageReported = true;
        record.inputTokens += res.usage.inputTokens;
        record.outputTokens += res.usage.outputTokens;
      }
      let reason: string;
      if (res.move === null) {
        const failure = res.failure ?? "malformed";
        record.formatFailures[failure] += 1;
        if (attempt === 1) record.firstAnswerFormat += 1;
        reason = FORMAT_FAILURE_REASON[failure];
      } else {
        const check = validateMove(n, history, res.move);
        if (check.ok) {
          chosen = check.action;
          continue;
        }
        record.illegalAttempts += 1;
        if (attempt === 1) record.firstAnswerIllegal += 1;
        reason = check.reason;
      }
      record.rejections.push(`turn ${history.length + 1}: ${reason}`);
      feedback = reason;
    }
    if (chosen === null) {
      record.result = "forfeit";
      record.winner = opponent(colour);
      record.turns = game.nturns;
      return record;
    }
    record.llmMoves += 1;
    game.update(colour, chosen);
    history.push(chosen);
    onMove?.(history);
  }

  const r = game.result!;
  record.turns = game.nturns;
  if (r.kind === "win") {
    record.winner = r.winner;
    record.result = r.winner === scheduled.llmColour ? "win" : "loss";
  } else {
    record.result = "draw";
  }
  return record;
}

/**
 * Players that can take the model's seat in a baseline replay: any tournament
 * agent, or "first-legal", a trivial script that always plays the first empty
 * cell in (r, q) order and never steals. As Blue that script fills row 0 from
 * left to right, which is a winning line unless Red blocks it, so it shows
 * what a "win" against the minimax agent is worth.
 */
export type BaselineId = AgentId | "first-legal";

export function firstLegalAction(n: number, history: readonly Action[]): Action {
  const [first] = Game.fromActions(n, history).legalPlacements();
  if (!first) throw new Error("no legal placement");
  return place(first[0], first[1]);
}

/** The same schedule with a baseline player in the model's seat (no API calls). */
export function playBaselineGame(
  n: number,
  g: ScheduledGame,
  agent: BaselineId,
  opponentAgent: AgentId = "minimax-dynamic",
) {
  // A scripted seat still needs an AgentId in the record; its moves come from the override.
  const seatId: AgentId = agent === "first-legal" ? "random" : agent;
  const rec = playTournamentGame(
    {
      id: `baseline-${g.index}`,
      n,
      red: g.llmColour === "red" ? seatId : opponentAgent,
      blue: g.llmColour === "blue" ? seatId : opponentAgent,
      seed: g.seed,
      round: g.index,
    },
    {
      move: (id, size, history, colour, seed) =>
        agent === "first-legal" && colour === g.llmColour
          ? firstLegalAction(size, history)
          : defaultTournamentMove(id, size, history, colour, seed),
    },
  );
  return { ...g, won: rec.winner === g.llmColour, draw: rec.winner === null, turns: rec.turns };
}

export interface BaselineSummary {
  games: number;
  wins: ProportionCI;
  draws: number;
  /** Games the baseline played as Red (the rest as Blue). */
  asRed: number;
  /** Per scheduled game, whether the baseline won it (for the paired comparison). */
  outcomes: { index: number; won: boolean }[];
}

/**
 * The scheduled games the model actually finished, in schedule order. A run
 * stopped early (by the visitor, a rate limit or a network error) must be
 * compared with the baselines on exactly these seeds and colours.
 */
export function completedSchedule(
  schedule: readonly ScheduledGame[],
  records: readonly Pick<LlmGameRecord, "index">[],
): ScheduledGame[] {
  const done = new Set(records.map((r) => r.index));
  return schedule.filter((g) => done.has(g.index));
}

/** A baseline replayed on the given games, or null when there are none. */
export function summariseBaseline(
  n: number,
  games: readonly ScheduledGame[],
  agent: BaselineId,
): BaselineSummary | null {
  if (games.length === 0) return null;
  const played = games.map((g) => playBaselineGame(n, g, agent));
  return {
    games: played.length,
    wins: wilson(played.filter((g) => g.won).length, played.length),
    draws: played.filter((g) => g.draw).length,
    asRed: games.filter((g) => g.llmColour === "red").length,
    outcomes: played.map((g) => ({ index: g.index, won: g.won })),
  };
}

export interface PairedWithLlm {
  /** Games both played (same seed and colour). */
  games: number;
  /** Games the model won and the baseline did not. */
  llmOnly: number;
  /** Games the baseline won and the model did not. */
  baselineOnly: number;
  /** Exact McNemar test on the discordant games (b = llmOnly, c = baselineOnly). */
  mcnemar: McNemarResult;
}

/**
 * The model and a baseline on the same scheduled games: only the games where
 * exactly one of them won say anything about the difference, so the
 * comparison is the discordant counts and an exact McNemar test, not two
 * overlapping intervals.
 */
export function pairWithLlm(
  records: readonly Pick<LlmGameRecord, "index" | "result">[],
  baseline: Pick<BaselineSummary, "outcomes">,
): PairedWithLlm | null {
  const baselineWon = new Map(baseline.outcomes.map((o) => [o.index, o.won]));
  let games = 0;
  let llmOnly = 0;
  let baselineOnly = 0;
  for (const r of records) {
    const b = baselineWon.get(r.index);
    if (b === undefined) continue;
    games++;
    const llm = r.result === "win";
    if (llm && !b) llmOnly++;
    if (b && !llm) baselineOnly++;
  }
  if (games === 0) return null;
  return { games, llmOnly, baselineOnly, mcnemar: mcnemarExact(llmOnly, baselineOnly) };
}

export interface LlmEvaluationSummary {
  games: number;
  wins: ProportionCI;
  losses: number;
  draws: number;
  forfeits: number;
  /** Games lost by running out of attempts on a turn, over all games. */
  forfeitRate: ProportionCI;
  /** Turns on which the model was asked for a move. */
  turns: number;
  /**
   * Share of turns whose first answer was rejected (illegal move or no usable
   * move). Per turn, not per answer: retries after a rejection are strongly
   * correlated with it, so counting them would overstate the sample size.
   * Turns within a game are correlated too, so the Wilson interval is on the
   * effective number of turns (design effect from the between-game spread,
   * never below 1); a plain Wilson interval over turns would treat them as
   * independent.
   */
  firstAnswerRejected: ClusteredProportionCI;
  firstAnswerIllegal: number;
  firstAnswerFormat: number;
  attempts: number;
  illegalAttempts: number;
  formatFailures: Record<FormatFailure, number>;
  meanLatencyMs: number;
  medianLatencyMs: number;
  meanInputTokens: number | null;
  meanOutputTokens: number | null;
}

export function summariseLlmGames(records: readonly LlmGameRecord[]): LlmEvaluationSummary {
  const sum = (f: (r: LlmGameRecord) => number) => records.reduce((s, r) => s + f(r), 0);
  const latencies = records.flatMap((r) => r.latencyMs);
  const turns = sum((r) => r.llmTurns);
  const firstIllegal = sum((r) => r.firstAnswerIllegal);
  const firstFormat = sum((r) => r.firstAnswerFormat);
  const forfeits = records.filter((r) => r.result === "forfeit").length;
  const reported = records.filter((r) => r.usageReported);
  const reportedAttempts = reported.reduce((s, r) => s + r.attempts, 0);
  return {
    games: records.length,
    wins: wilson(records.filter((r) => r.result === "win").length, records.length),
    losses: records.filter((r) => r.result === "loss" || r.result === "forfeit").length,
    draws: records.filter((r) => r.result === "draw").length,
    forfeits,
    forfeitRate: wilson(forfeits, records.length),
    turns,
    firstAnswerRejected: clusteredWilson(
      records.map((r) => ({
        successes: r.firstAnswerIllegal + r.firstAnswerFormat,
        n: r.llmTurns,
      })),
    ),
    firstAnswerIllegal: firstIllegal,
    firstAnswerFormat: firstFormat,
    attempts: sum((r) => r.attempts),
    illegalAttempts: sum((r) => r.illegalAttempts),
    formatFailures: {
      malformed: sum((r) => r.formatFailures.malformed),
      truncated: sum((r) => r.formatFailures.truncated),
      refusal: sum((r) => r.formatFailures.refusal),
    },
    meanLatencyMs: latencies.length ? latencies.reduce((s, x) => s + x, 0) / latencies.length : NaN,
    medianLatencyMs: latencies.length ? median(latencies) : NaN,
    meanInputTokens: reportedAttempts
      ? reported.reduce((s, r) => s + r.inputTokens, 0) / reportedAttempts
      : null,
    meanOutputTokens: reportedAttempts
      ? reported.reduce((s, r) => s + r.outputTokens, 0) / reportedAttempts
      : null,
  };
}

export function llmGamesCsvRows(records: readonly LlmGameRecord[]) {
  return records.map((r) => ({
    game: r.index + 1,
    board_n: r.n,
    seed: r.seed,
    llm_colour: r.llmColour,
    result: r.result,
    winner: r.winner ?? "",
    turns: r.turns,
    llm_moves: r.llmMoves,
    llm_turns: r.llmTurns,
    first_answer_illegal: r.firstAnswerIllegal,
    first_answer_no_move: r.firstAnswerFormat,
    answers: r.attempts,
    illegal_answers: r.illegalAttempts,
    malformed_answers: r.formatFailures.malformed,
    truncated_answers: r.formatFailures.truncated,
    refused_answers: r.formatFailures.refusal,
    mean_latency_ms: r.latencyMs.length
      ? Math.round(r.latencyMs.reduce((s, x) => s + x, 0) / r.latencyMs.length)
      : null,
    input_tokens: r.usageReported ? r.inputTokens : null,
    output_tokens: r.usageReported ? r.outputTokens : null,
    moves: r.actions.map(label).join(" "),
    rejections: r.rejections.join(" | "),
  }));
}
