/**
 * Framework-free helpers that turn an action history into what the board UI
 * needs: cell colours, the latest move, captured tokens and the winning chain.
 */
import { AgentBoard } from "@/lib/agent/agent-board";
import { evaluate } from "@/lib/agent/evaluation";
import { Game } from "./game";
import { type Action, type Colour, type Coord, isSteal, opponent } from "./types";

export type PlayerKind = "human" | "minimax" | "random";

export interface MatchView {
  game: Game;
  cells: (Colour | null)[];
  lastMove: Coord | null;
  captured: { coord: Coord; colour: Colour }[];
  winning: Coord[] | null;
}

export function deriveMatchView(n: number, actions: readonly Action[]): MatchView {
  const game = Game.fromActions(n, actions);
  const cells: (Colour | null)[] = [];
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) cells.push(game.board.get(r, q));
  const last = game.log.at(-1);
  const lastMove =
    last && !isSteal(last.action) ? ([last.action[1], last.action[2]] as const) : null;
  const captured = last
    ? last.captures.map((coord) => ({ coord, colour: opponent(last.player) }))
    : [];
  const winning = game.result?.kind === "win" ? game.result.cluster : null;
  return { game, cells, lastMove, captured, winning };
}

/** The original evaluation (Red-positive, no random bias) after every move. */
export function evaluationTrend(n: number, actions: readonly Action[]): number[] {
  const board = new AgentBoard(n);
  const out: number[] = [evaluate(board)];
  actions.forEach((action, i) => {
    board.update(i % 2 === 0 ? "red" : "blue", action);
    out.push(evaluate(board));
  });
  return out;
}

/** Player to move after `count` actions. */
export const playerToMove = (count: number): Colour => (count % 2 === 0 ? "red" : "blue");

/**
 * Undo back to the most recent position where a human is to move, removing
 * at least one action.
 */
export function undoToHumanTurn(
  actions: readonly Action[],
  kinds: Record<Colour, PlayerKind>,
): Action[] {
  const next = actions.slice();
  if (next.length === 0) return next;
  next.pop();
  while (next.length > 0 && kinds[playerToMove(next.length)] !== "human") next.pop();
  return next;
}
