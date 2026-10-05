/**
 * Port of the `_4399` Player.action logic
 * (coursework/Project Part B/code/_4399/player.py):
 *
 *  1. forced opening moves on the first two turns,
 *  2. play an immediately winning move if one exists,
 *  3. otherwise minimax + alpha-beta with a dynamically allocated depth.
 */
import { type Action, type Colour, STEAL, place } from "@/lib/cachex/types";
import { AgentBoard } from "./agent-board";
import {
  type BiasFn,
  type FeatureContribution,
  computeFeatures,
  explainFeatures,
  noBias,
} from "./evaluation";
import { type MoveOrder, createContext, gameEnd, getValidActions, minimax } from "./minimax";

/** Empty-cell ratios at which the search deepens (index + 1 = depth). */
export const TARGET_RATES = [0.15, 0.1, 0.05] as const;

/** `dynamic_depth_allocation` */
export function dynamicDepthAllocation(board: AgentBoard): number {
  const emptyRate = board.emptyCount() / board.n ** 2;
  for (let i = 0; i < TARGET_RATES.length; i++) {
    if (emptyRate >= TARGET_RATES[i]) return i + 1;
  }
  return 4;
}

/** `enforced_gamestart_play` — the hand-written opening book. */
export function enforcedGamestartPlay(
  n: number,
  player: Colour,
  board: AgentBoard,
): { action: Action; rule: string } {
  if (n === 3) {
    if (player === "blue" && board.isOccupied(0, 1)) {
      return { action: STEAL, rule: "On a 3×3 board Blue steals Red's opening at (0, 1)." };
    }
    if (player === "red")
      return { action: place(1, 0), rule: "On a 3×3 board Red opens at (1, 0)." };
    return { action: place(0, 1), rule: "On a 3×3 board Blue takes (0, 1)." };
  }
  if (player === "blue" && board.isOccupied(1, 1)) {
    return { action: STEAL, rule: "Red opened on the strong cell (1, 1), so Blue steals it." };
  }
  return { action: place(1, 1), rule: "The opening book always plays the strong cell (1, 1)." };
}

export interface CandidateScore {
  action: Action;
  score: number;
}

export type MoveExplanation =
  | { kind: "opening"; rule: string }
  | { kind: "instant-win" }
  | {
      kind: "search";
      depth: number;
      score: number;
      nodes: number;
      candidates: CandidateScore[];
      /** Features of the board after the chosen move. */
      features: FeatureContribution[];
    }
  | { kind: "random"; options: number };

export interface AgentDecision {
  action: Action;
  explanation: MoveExplanation;
}

export interface AgentOptions {
  order?: MoveOrder;
  bias?: BiasFn;
  /** Use the opening book on turns 1 and 2 (the original's default). */
  enforceGamePlay?: boolean;
}

/** Choose the agent's action for `colour`, given the full action history. */
export function chooseAgentAction(
  n: number,
  history: readonly Action[],
  colour: Colour,
  options: AgentOptions = {},
): AgentDecision {
  const board = AgentBoard.fromActions(n, history);
  return agentAction(board, colour, options);
}

export function agentAction(
  board: AgentBoard,
  colour: Colour,
  options: AgentOptions = {},
): AgentDecision {
  const { order = "canonical", bias = noBias, enforceGamePlay = true } = options;

  if (board.turn <= 2 && enforceGamePlay) {
    const { action, rule } = enforcedGamestartPlay(board.n, colour, board);
    return { action, explanation: { kind: "opening", rule } };
  }

  // Play an immediate win without searching.
  for (const action of getValidActions(board, order)) {
    const tmp = board.clone();
    tmp.update(colour, action);
    if (gameEnd(tmp)) return { action, explanation: { kind: "instant-win" } };
  }

  const depth = dynamicDepthAllocation(board);
  const ctx = createContext(order, bias);
  ctx.rootScores = [];
  const [score, action] = minimax(board, depth, -Infinity, Infinity, colour === "red", ctx, true);
  if (action === null) throw new Error("minimax found no legal action");

  const after = board.clone();
  after.update(colour, action);
  const cmp = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1);
  const candidates = [...ctx.rootScores].sort((a, b) =>
    colour === "red" ? cmp(b.score, a.score) : cmp(a.score, b.score),
  );

  return {
    action,
    explanation: {
      kind: "search",
      depth,
      score,
      nodes: ctx.nodes,
      candidates,
      features: explainFeatures(computeFeatures(after)),
    },
  };
}
