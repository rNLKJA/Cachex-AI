/**
 * Plays one tournament game under the ported referee rules. The referee
 * validates every action; an exception or an illegal action counts as an
 * illegal move and forfeits the game to the opponent.
 */
import { Game } from "@/lib/cachex/game";
import { type Action, type Colour, opponent } from "@/lib/cachex/types";
import { createRng, deriveSeed } from "@/lib/rng";
import { type AgentId, tournamentMove } from "./agents";
import type { GameSpec } from "./schedule";

export interface SideStats {
  agent: AgentId;
  moves: number;
  /** Total wall-clock time spent choosing moves, in ms. */
  totalMs: number;
  maxMs: number;
  /** Search nodes visited across the game (0 for random / book moves). */
  nodes: number;
  /** Moves chosen by a minimax search (not the book, an instant win or random). */
  searches: number;
  /** Of those, searches deeper than one ply. */
  deepSearches: number;
  illegal: number;
}

export interface GameRecord {
  id: string;
  n: number;
  seed: number;
  round: number;
  result: "win" | "draw" | "forfeit";
  winner: Colour | null;
  drawReason: "repetition" | "max-turns" | null;
  turns: number;
  red: SideStats;
  blue: SideStats;
}

export type MoveFn = (
  id: AgentId,
  n: number,
  history: readonly Action[],
  colour: Colour,
  seed: number,
) => Action | { action: Action; nodes?: number; depth?: number | null };

const defaultMove: MoveFn = (id, n, history, colour, seed) => {
  const decision = tournamentMove(id, n, history, colour, createRng(seed));
  const e = decision.explanation;
  return {
    action: decision.action,
    nodes: e.kind === "search" ? e.nodes : 0,
    depth: e.kind === "search" ? e.depth : null,
  };
};

export function playTournamentGame(
  spec: GameSpec,
  { move = defaultMove, now = () => performance.now() }: { move?: MoveFn; now?: () => number } = {},
): GameRecord {
  const game = new Game(spec.n);
  const history: Action[] = [];
  const side = (agent: AgentId): SideStats => ({
    agent,
    moves: 0,
    totalMs: 0,
    maxMs: 0,
    nodes: 0,
    searches: 0,
    deepSearches: 0,
    illegal: 0,
  });
  const stats: Record<Colour, SideStats> = { red: side(spec.red), blue: side(spec.blue) };

  while (!game.over()) {
    const colour = game.turnPlayer();
    const s = stats[colour];
    const started = now();
    let action: Action | null = null;
    try {
      const out = move(s.agent, spec.n, history, colour, deriveSeed(spec.seed, history.length));
      if (Array.isArray(out)) action = out as Action;
      else {
        const result = out as { action: Action; nodes?: number; depth?: number | null };
        action = result.action;
        s.nodes += result.nodes ?? 0;
        if (typeof result.depth === "number") {
          s.searches += 1;
          if (result.depth > 1) s.deepSearches += 1;
        }
      }
    } catch {
      action = null;
    }
    const elapsed = now() - started;
    s.moves += 1;
    s.totalMs += elapsed;
    s.maxMs = Math.max(s.maxMs, elapsed);

    if (action === null || !game.isLegal(action)) {
      s.illegal += 1;
      return finish(spec, game, stats, { result: "forfeit", winner: opponent(colour) });
    }
    game.update(colour, action);
    history.push(action);
  }

  const r = game.result!;
  return finish(
    spec,
    game,
    stats,
    r.kind === "win"
      ? { result: "win", winner: r.winner }
      : { result: "draw", winner: null, drawReason: r.reason },
  );
}

function finish(
  spec: GameSpec,
  game: Game,
  stats: Record<Colour, SideStats>,
  outcome: {
    result: GameRecord["result"];
    winner: Colour | null;
    drawReason?: GameRecord["drawReason"];
  },
): GameRecord {
  return {
    id: spec.id,
    n: spec.n,
    seed: spec.seed,
    round: spec.round,
    result: outcome.result,
    winner: outcome.winner,
    drawReason: outcome.drawReason ?? null,
    turns: game.nturns,
    red: stats.red,
    blue: stats.blue,
  };
}

/** The agent that won, or null for a draw. */
export const winningAgent = (g: GameRecord): AgentId | null =>
  g.winner === null ? null : g[g.winner].agent;
