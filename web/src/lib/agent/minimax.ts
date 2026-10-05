/**
 * Port of coursework/Project Part B/code/_4399/minimax.py:
 * minimax with alpha-beta pruning, the terminal test and move generation.
 */
import { type Action, type Colour, PLAYER_AXIS, STEAL, isSteal, place } from "@/lib/cachex/types";
import { type Rng, shuffle } from "@/lib/rng";
import type { AgentBoard } from "./agent-board";
import { type BiasFn, evaluate, noBias } from "./evaluation";

export type MoveOrder = "canonical" | Rng;

export interface SearchContext {
  /**
   * How candidate moves are ordered. The original shuffles them with
   * `random.shuffle`; "canonical" sorts them like Python sorts the action
   * tuples (PLACE by (r, q), then STEAL), which is what the parity tests use.
   */
  order: MoveOrder;
  bias: BiasFn;
  /** Number of nodes visited (for the UI). */
  nodes: number;
  /** Root-level (action, score) pairs, recorded when requested. */
  rootScores?: { action: Action; score: number }[];
}

export const createContext = (
  order: MoveOrder = "canonical",
  bias: BiasFn = noBias,
): SearchContext => ({
  order,
  bias,
  nodes: 0,
});

/**
 * `game_end`: true if the last PLACE completed a winning chain for the player
 * who made it (sets `board.winner`). Note the original's quirks are kept: a
 * full board, a STEAL, or no move yet all count as "not ended".
 */
export function gameEnd(board: AgentBoard): boolean {
  if (board.emptyCount() === 0) return false;
  const last = board.lastAction;
  if (last === null || isSteal(last)) return false;
  const [, r, q] = last;
  const reachable = board.connectedCoords(r, q);
  const axis = PLAYER_AXIS[board.lastPlayer];
  let min = Infinity;
  let max = -Infinity;
  for (const c of reachable) {
    if (c[axis] < min) min = c[axis];
    if (c[axis] > max) max = c[axis];
  }
  if (min === 0 && max === board.n - 1) {
    board.winner = board.lastPlayer;
    return true;
  }
  return false;
}

/** `get_valid_actions`: every empty cell, minus the centre on move 1, plus STEAL on move 2. */
export function getValidActions(board: AgentBoard, order: MoveOrder): Action[] {
  const centre = Math.floor(board.n / 2);
  const actions: Action[] = [];
  for (const [r, q] of board.availableHexagons()) {
    if (board.turn === 1 && board.isOdd() && r === centre && q === centre) continue;
    actions.push(place(r, q));
  }
  if (board.turn === 2) actions.push(STEAL);
  // availableHexagons() is already sorted by (r, q) with STEAL appended last,
  // which matches Python's sort order for ("PLACE", r, q) < ("STEAL",).
  if (order !== "canonical") shuffle(order, actions);
  return actions;
}

/**
 * `minimax(board, depth, alpha, beta, maximizingPlayer)`.
 * Red is the maximising player, Blue the minimising player.
 * Returns [score, action]; action is null at leaves.
 */
export function minimax(
  board: AgentBoard,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  ctx: SearchContext,
  isRoot = false,
): [number, Action | null] {
  ctx.nodes += 1;
  const player: Colour = maximizingPlayer ? "red" : "blue";

  if (depth === 0 || gameEnd(board)) {
    if (board.winner === null) return [evaluate(board, ctx.bias), null];
    return [board.winner === "red" ? Infinity : -Infinity, null];
  }

  const actions = getValidActions(board, ctx.order);

  if (maximizingPlayer) {
    let maxScore = -Infinity;
    let maxAction: Action | null = null;
    for (const action of actions) {
      const child = board.clone();
      child.update(player, action);
      const [score] = minimax(child, depth - 1, alpha, beta, false, ctx);
      if (isRoot) ctx.rootScores?.push({ action, score });
      if (score >= maxScore) {
        maxScore = score;
        maxAction = action;
      }
      if (maxScore >= alpha) alpha = maxScore;
      if (alpha >= beta) break;
    }
    return [maxScore, maxAction];
  }

  let minScore = Infinity;
  let minAction: Action | null = null;
  for (const action of actions) {
    const child = board.clone();
    child.update(player, action);
    const [score] = minimax(child, depth - 1, alpha, beta, true, ctx);
    if (isRoot) ctx.rootScores?.push({ action, score });
    if (score <= minScore) {
      minScore = score;
      minAction = action;
    }
    if (beta <= minScore) beta = minScore;
    if (alpha >= beta) break;
  }
  return [minScore, minAction];
}
