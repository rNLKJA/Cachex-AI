/**
 * "LLM as a player": an evaluation harness in which a language model plays
 * short games of Cachex against the original minimax agent.
 *
 * The model sees the rules, the board, the move history and the full list of
 * legal moves, and must answer with structured JSON. Every answer is checked
 * against the referee: a malformed or illegal answer counts as an illegal
 * attempt and the model is asked again (with the reason), up to
 * `maxAttempts`; after that it forfeits the game. Colours alternate so the
 * model plays as many games as Red as it does as Blue, and the same schedule
 * (seeds and colours) is replayed with the random baseline in the model's
 * seat, giving a side-by-side comparison on identical conditions.
 */
import { z } from "zod";

import { Game } from "@/lib/cachex/game";
import { type Action, type Colour, STEAL, formatAction, opponent, place } from "@/lib/cachex/types";
import { deriveSeed } from "@/lib/rng";
import { median } from "@/lib/stats/descriptive";
import { type ProportionCI, wilson } from "@/lib/stats/proportion";
import { type AgentId } from "@/lib/tournament/agents";
import { playTournamentGame } from "@/lib/tournament/play";
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

export function renderBoard(game: Game): string {
  const n = game.n;
  const lines: string[] = [];
  lines.push(`     ${Array.from({ length: n }, (_, q) => `q${q}`.padEnd(3)).join("")}`);
  for (let r = 0; r < n; r++) {
    const row = Array.from({ length: n }, (_, q) => {
      const c = game.board.get(r, q);
      return (c === "red" ? "R" : c === "blue" ? "B" : ".").padEnd(3);
    }).join("");
    lines.push(`r${String(r).padEnd(2)} ${" ".repeat(r)}${row}`);
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
    "Board (R = red, B = blue, . = empty; each row is drawn shifted to show the hex layout):",
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

export interface LlmCallResult {
  /** null when the reply could not be parsed into the move schema. */
  move: LlmMove | null;
  latencyMs: number;
  usage: TokenUsage | null;
}

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
  attempts: number;
  illegalAttempts: number;
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
    attempts: 0,
    illegalAttempts: 0,
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
      const check: MoveCheck = res.move
        ? validateMove(n, history, res.move)
        : { ok: false, reason: "The reply did not match the move format." };
      if (check.ok) chosen = check.action;
      else {
        record.illegalAttempts += 1;
        record.rejections.push(`turn ${history.length + 1}: ${check.reason}`);
        feedback = check.reason;
      }
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

/** The same schedule with a built-in agent in the model's seat (no API calls). */
export function playBaselineGame(
  n: number,
  g: ScheduledGame,
  agent: AgentId,
  opponentAgent: AgentId = "minimax-dynamic",
) {
  const rec = playTournamentGame({
    id: `baseline-${g.index}`,
    n,
    red: g.llmColour === "red" ? agent : opponentAgent,
    blue: g.llmColour === "blue" ? agent : opponentAgent,
    seed: g.seed,
    round: g.index,
  });
  return { ...g, won: rec.winner === g.llmColour, draw: rec.winner === null, turns: rec.turns };
}

export interface LlmEvaluationSummary {
  games: number;
  wins: ProportionCI;
  losses: number;
  draws: number;
  forfeits: number;
  /** Illegal or malformed answers over all answers. */
  illegalRate: ProportionCI;
  attempts: number;
  meanLatencyMs: number;
  medianLatencyMs: number;
  meanInputTokens: number | null;
  meanOutputTokens: number | null;
}

export function summariseLlmGames(records: readonly LlmGameRecord[]): LlmEvaluationSummary {
  const latencies = records.flatMap((r) => r.latencyMs);
  const attempts = records.reduce((s, r) => s + r.attempts, 0);
  const illegal = records.reduce((s, r) => s + r.illegalAttempts, 0);
  const reported = records.filter((r) => r.usageReported);
  const reportedAttempts = reported.reduce((s, r) => s + r.attempts, 0);
  return {
    games: records.length,
    wins: wilson(records.filter((r) => r.result === "win").length, records.length),
    losses: records.filter((r) => r.result === "loss" || r.result === "forfeit").length,
    draws: records.filter((r) => r.result === "draw").length,
    forfeits: records.filter((r) => r.result === "forfeit").length,
    illegalRate: wilson(illegal, attempts),
    attempts,
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
    answers: r.attempts,
    illegal_answers: r.illegalAttempts,
    mean_latency_ms: r.latencyMs.length
      ? Math.round(r.latencyMs.reduce((s, x) => s + x, 0) / r.latencyMs.length)
      : null,
    input_tokens: r.usageReported ? r.inputTokens : null,
    output_tokens: r.usageReported ? r.outputTokens : null,
    moves: r.actions.map(label).join(" "),
    rejections: r.rejections.join(" | "),
  }));
}
