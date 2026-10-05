/**
 * How much work does alpha-beta pruning save the `_4399` search?
 *
 * For a sample of mid-game positions, the ported minimax runs twice at the
 * same depth from the same position: once as written (with cut-offs) and once
 * with pruning switched off. Plain minimax visits every node, so its count does
 * not depend on move order; the pruned count does, so it is measured with both
 * the agent's shuffled order and the canonical (r, q) order. The evaluation's
 * random tie-break bias is switched off so both runs score positions
 * identically, which lets the study check that pruning never changes the
 * value of the root.
 *
 * Finding: the original's minimising branch updates beta with
 * `if beta <= min_score: beta = min_score`, which only ever raises beta, so
 * the window never tightens there and most cut-offs are lost. The result is
 * still correct (a looser window never changes the minimax value), just slow.
 * The study therefore also measures a textbook alpha-beta (beta =
 * min(beta, score)) with identical move generation and evaluation, to show
 * what the one-line fix would buy. The agent itself is left as submitted.
 */
import { AgentBoard } from "@/lib/agent/agent-board";
import { noBias } from "@/lib/agent/evaluation";
import { evaluate } from "@/lib/agent/evaluation";
import {
  type SearchContext,
  createContext,
  gameEnd,
  getValidActions,
  minimax,
} from "@/lib/agent/minimax";
import type { Action, Colour } from "@/lib/cachex/types";
import { createRng, deriveSeed, randInt } from "@/lib/rng";
import { type BootstrapCI, bootstrap, bootstrapMean } from "@/lib/stats/bootstrap";
import { geometricMean, median } from "@/lib/stats/descriptive";
import { tournamentMove } from "@/lib/tournament/agents";
import { playTournamentGame } from "@/lib/tournament/play";

export type SearchOrder = "shuffled" | "canonical";

export interface PruningPosition {
  n: number;
  actions: Action[];
  /** Cells still empty. */
  empty: number;
  toMove: Colour;
  seed: number;
}

export interface PruningSample {
  n: number;
  depth: number;
  order: SearchOrder;
  empty: number;
  nodesPruned: number;
  nodesFull: number;
  /** nodesPruned / nodesFull: the share of the full tree alpha-beta still visits. */
  ratio: number;
  /** Did pruning return the same root value as full minimax? */
  valueMatches: boolean;
  /** Nodes visited by textbook alpha-beta (corrected beta update), same order. */
  nodesTextbook: number;
  ratioTextbook: number;
  textbookValueMatches: boolean;
}

/**
 * Mid-game positions from seeded greedy-vs-random games, taken after the
 * opening (turn 3 onwards) and before the game ends.
 */
export function samplePositions({
  sizes,
  perSize,
  seed,
}: {
  sizes: readonly number[];
  perSize: number;
  seed: number;
}): PruningPosition[] {
  const out: PruningPosition[] = [];
  for (const n of sizes) {
    let attempt = 0;
    let found = 0;
    while (found < perSize && attempt < perSize * 20) {
      const gameSeed = deriveSeed(seed, n, attempt++);
      const actions = replayActions(n, gameSeed);
      if (actions.length < 4) continue;
      const rng = createRng(deriveSeed(gameSeed, 1));
      const cut = randInt(rng, 2, actions.length - 1);
      const board = AgentBoard.fromActions(n, actions.slice(0, cut));
      out.push({
        n,
        actions: actions.slice(0, cut),
        empty: board.emptyCount(),
        toMove: cut % 2 === 0 ? "red" : "blue",
        seed: gameSeed,
      });
      found++;
    }
  }
  return out;
}

/** The actions of one seeded greedy (Red) vs random (Blue) game. */
function replayActions(n: number, seed: number): Action[] {
  const actions: Action[] = [];
  playTournamentGame(
    { id: "sample", n, red: "greedy", blue: "random", seed, round: 0 },
    {
      now: () => 0,
      move: (id, size, history, colour, moveSeed) => {
        const { action } = tournamentMove(id, size, history, colour, createRng(moveSeed));
        actions.push(action);
        return action;
      },
    },
  );
  return actions;
}

/**
 * Textbook alpha-beta: identical to the port except that the minimising
 * branch lowers beta (beta = min(beta, score)). Study-only; never used to play.
 */
export function textbookAlphaBeta(
  board: AgentBoard,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  ctx: SearchContext,
): number {
  ctx.nodes += 1;
  const player: Colour = maximizingPlayer ? "red" : "blue";
  if (depth === 0 || gameEnd(board)) {
    if (board.winner === null) return evaluate(board, ctx.bias);
    return board.winner === "red" ? Infinity : -Infinity;
  }
  const actions = getValidActions(board, ctx.order);
  if (maximizingPlayer) {
    let best = -Infinity;
    for (const action of actions) {
      const child = board.clone();
      child.update(player, action);
      best = Math.max(best, textbookAlphaBeta(child, depth - 1, alpha, beta, false, ctx));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const action of actions) {
    const child = board.clone();
    child.update(player, action);
    best = Math.min(best, textbookAlphaBeta(child, depth - 1, alpha, beta, true, ctx));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

export function measurePruning(
  position: PruningPosition,
  depth: number,
  order: SearchOrder,
): PruningSample {
  const board = AgentBoard.fromActions(position.n, position.actions);
  const maximizing = position.toMove === "red";
  const context = (prune: boolean) =>
    createContext(
      order === "canonical" ? "canonical" : createRng(deriveSeed(position.seed, depth)),
      noBias,
      prune,
    );
  const search = (prune: boolean) => {
    const ctx = context(prune);
    const [score] = minimax(board.clone(), depth, -Infinity, Infinity, maximizing, ctx);
    return { score, nodes: ctx.nodes };
  };
  const pruned = search(true);
  const full = search(false);
  const tctx = context(true);
  const textbook = textbookAlphaBeta(board.clone(), depth, -Infinity, Infinity, maximizing, tctx);
  return {
    n: position.n,
    depth,
    order,
    empty: position.empty,
    nodesPruned: pruned.nodes,
    nodesFull: full.nodes,
    ratio: pruned.nodes / full.nodes,
    valueMatches: pruned.score === full.score,
    nodesTextbook: tctx.nodes,
    ratioTextbook: tctx.nodes / full.nodes,
    textbookValueMatches: textbook === full.score,
  };
}

export interface PruningGroup {
  n: number;
  depth: number;
  order: SearchOrder;
  positions: number;
  meanFull: number;
  meanPruned: number;
  /** Mean per-position ratio with a bootstrap CI over positions. */
  meanRatio: BootstrapCI;
  medianRatio: number;
  geoMeanRatio: number;
  /** Σ pruned / Σ full, with a bootstrap CI over positions. */
  pooledRatio: BootstrapCI;
  valueMatches: number;
  meanTextbook: number;
  /** Mean per-position ratio for textbook alpha-beta. */
  textbookRatio: BootstrapCI;
  textbookValueMatches: number;
}

export function summarisePruning(
  samples: readonly PruningSample[],
  { reps = 2000, seed = 30024 }: { reps?: number; seed?: number } = {},
): PruningGroup[] {
  const groups = new Map<string, PruningSample[]>();
  for (const s of samples) {
    const key = `${s.n}|${s.depth}|${s.order}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.values()]
    .map((list, k) => {
      const ratios = list.map((s) => s.ratio);
      return {
        n: list[0].n,
        depth: list[0].depth,
        order: list[0].order,
        positions: list.length,
        meanFull: list.reduce((s, x) => s + x.nodesFull, 0) / list.length,
        meanPruned: list.reduce((s, x) => s + x.nodesPruned, 0) / list.length,
        meanRatio: bootstrapMean(ratios, { reps, seed: seed + k }),
        medianRatio: median(ratios),
        geoMeanRatio: geometricMean(ratios),
        pooledRatio: bootstrap(
          list,
          (xs) =>
            xs.reduce((s, x) => s + x.nodesPruned, 0) / xs.reduce((s, x) => s + x.nodesFull, 0),
          { reps, seed: seed + 1000 + k },
        ),
        valueMatches: list.filter((s) => s.valueMatches).length,
        meanTextbook: list.reduce((s, x) => s + x.nodesTextbook, 0) / list.length,
        textbookRatio: bootstrapMean(
          list.map((s) => s.ratioTextbook),
          { reps, seed: seed + 2000 + k },
        ),
        textbookValueMatches: list.filter((s) => s.textbookValueMatches).length,
      };
    })
    .sort((a, b) => a.order.localeCompare(b.order) || a.n - b.n || a.depth - b.depth);
}
