/**
 * Paired Manhattan vs Euclidean study for the Part A A* search.
 *
 * Both heuristics run on the *same* random boards (the notebook's generator),
 * so the comparison is paired: the unit of analysis is a board, and the
 * quantity of interest is the per-board difference in node expansions.
 *
 * It also checks optimality. On this hex grid (axial coordinates, the six
 * steps in HEX_STEPS) the true distance between two cells is
 * max(|dr|, |dq|, |dr + dq|). Manhattan |dr| + |dq| and Euclidean
 * sqrt(dr² + dq²) both exceed it whenever dr and dq have opposite signs, so
 * neither heuristic is admissible and A* may return a longer path than
 * necessary. A breadth-first search gives the true shortest path to compare
 * against.
 */
import { type AStarBoard, astar } from "@/lib/astar/astar";
import { notebookExpansions, randomNotebookBoard } from "@/lib/astar/random-board";
import { HEX_STEPS } from "@/lib/cachex/board";
import type { Coord } from "@/lib/cachex/types";
import { createRng } from "@/lib/rng";
import { type BootstrapCI, pairedMeanDifference } from "@/lib/stats/bootstrap";
import { median } from "@/lib/stats/descriptive";
import { type McNemarResult, mcnemarExact } from "@/lib/stats/mcnemar";
import { type ProportionCI, wilson } from "@/lib/stats/proportion";
import { type WilcoxonResult, wilcoxonSignedRank } from "@/lib/stats/wilcoxon";

/** True shortest-path distance (in steps) between two cells on an empty board. */
export function hexDistance(a: Coord, b: Coord): number {
  const dr = b[0] - a[0];
  const dq = b[1] - a[1];
  return Math.max(Math.abs(dr), Math.abs(dq), Math.abs(dr + dq));
}

/**
 * Shortest path length in cells (start and goal included, like the A* output)
 * when every occupied tile blocks, or null when the goal is unreachable.
 */
export function bfsPathCells(board: AStarBoard): number | null {
  const { n, cells, start, goal } = board;
  const id = (r: number, q: number) => r * n + q;
  if (cells[id(start[0], start[1])] !== null) return null;
  const dist = new Int32Array(n * n).fill(-1);
  const queue = new Int32Array(n * n);
  let head = 0;
  let tail = 0;
  const s = id(start[0], start[1]);
  dist[s] = 0;
  queue[tail++] = s;
  const g = id(goal[0], goal[1]);
  while (head < tail) {
    const cur = queue[head++];
    if (cur === g) return dist[cur] + 1;
    const r = Math.floor(cur / n);
    const q = cur % n;
    for (const [dr, dq] of HEX_STEPS) {
      const nr = r + dr;
      const nq = q + dq;
      if (nr < 0 || nq < 0 || nr >= n || nq >= n) continue;
      const ni = id(nr, nq);
      if (dist[ni] !== -1 || cells[ni] !== null) continue;
      dist[ni] = dist[cur] + 1;
      queue[tail++] = ni;
    }
  }
  return null;
}

export interface HeuristicRun {
  /** The notebook's expansion counter (queue insertions after the start). */
  expansions: number;
  /** Priority-queue pops. */
  pops: number;
  /** Path length in cells, or 0 when no path was found. */
  cells: number;
}

export interface PairedStudyRow {
  dimension: number;
  /** Index of the board within its dimension. */
  board: number;
  /** BFS shortest path in cells, or null when start and goal are disconnected. */
  optimalCells: number | null;
  manhattan: HeuristicRun;
  euclidean: HeuristicRun;
}

export interface PairedStudyConfig {
  dimensions: readonly number[];
  boardsPerDimension: number;
  seed: number;
}

const run = (board: AStarBoard, heuristic: "manhattan" | "euclidean"): HeuristicRun => {
  const r = astar(board, heuristic);
  return { expansions: notebookExpansions(r), pops: r.pops, cells: r.path.length };
};

/**
 * Generate boards in dimension order from one seeded stream. With one board
 * per dimension this reproduces `runHeuristicBenchmark` board for board.
 */
export function runPairedStudy({
  dimensions,
  boardsPerDimension,
  seed,
}: PairedStudyConfig): PairedStudyRow[] {
  const rng = createRng(seed);
  const rows: PairedStudyRow[] = [];
  for (const dimension of dimensions) {
    for (let b = 0; b < boardsPerDimension; b++) {
      const board = randomNotebookBoard(dimension, rng);
      rows.push({
        dimension,
        board: b,
        optimalCells: bfsPathCells(board),
        manhattan: run(board, "manhattan"),
        euclidean: run(board, "euclidean"),
      });
    }
  }
  return rows;
}

export interface PairedStudySummary {
  boards: number;
  boardsWithPath: number;
  expansions: {
    meanManhattan: number;
    meanEuclidean: number;
    /** Mean of (Manhattan − Euclidean) per board, with a paired bootstrap CI. */
    meanDiff: BootstrapCI;
    medianDiff: number;
    /** Cohen's d_z of the paired differences. */
    dz: number;
    wilcoxon: WilcoxonResult;
    manhattanFewer: number;
    euclideanFewer: number;
    ties: number;
  };
  optimality: {
    /** Boards (with a path) where A* returned a shortest path. */
    manhattan: ProportionCI;
    euclidean: ProportionCI;
    /** Boards where both heuristics returned paths of the same length. */
    agreement: ProportionCI;
    /**
     * Paired comparison on the same boards: Manhattan's optimal-path rate minus
     * Euclidean's, with a paired bootstrap CI that resamples boards.
     */
    difference: BootstrapCI;
    /** Exact McNemar test on the discordant boards (b: Manhattan only, c: Euclidean only). */
    mcnemar: McNemarResult;
    /** Mean extra cells over the shortest path, across boards with a path. */
    manhattanExcess: number;
    euclideanExcess: number;
    /** Largest extra length seen. */
    maxExcess: number;
  };
  /** Proportion of ordered cell pairs on an empty board where each heuristic overestimates. */
  overestimation: { dimension: number; manhattan: number; euclidean: number };
}

/** Share of ordered (start, goal) pairs on an empty d × d board where h > true distance. */
export function overestimationRate(dimension: number): { manhattan: number; euclidean: number } {
  let pairs = 0;
  let m = 0;
  let e = 0;
  for (let a = 0; a < dimension * dimension; a++) {
    for (let b = 0; b < dimension * dimension; b++) {
      if (a === b) continue;
      const s: Coord = [Math.floor(a / dimension), a % dimension];
      const g: Coord = [Math.floor(b / dimension), b % dimension];
      const d = hexDistance(s, g);
      const dr = Math.abs(g[0] - s[0]);
      const dq = Math.abs(g[1] - s[1]);
      pairs++;
      if (dr + dq > d) m++;
      if (Math.sqrt(dr * dr + dq * dq) > d + 1e-12) e++;
    }
  }
  return { manhattan: m / pairs, euclidean: e / pairs };
}

export function summarisePairedStudy(
  rows: readonly PairedStudyRow[],
  { reps = 2000, seed = 2022 }: { reps?: number; seed?: number } = {},
): PairedStudySummary {
  const m = rows.map((r) => r.manhattan.expansions);
  const e = rows.map((r) => r.euclidean.expansions);
  const paired = pairedMeanDifference(m, e, { reps, seed });
  const diffs = m.map((x, i) => x - e[i]);
  const withPath = rows.filter((r) => r.optimalCells !== null);
  const isOptimal = (key: "manhattan" | "euclidean") =>
    withPath.map((r): number => (r[key].cells === r.optimalCells ? 1 : 0));
  const mOpt = isOptimal("manhattan");
  const eOpt = isOptimal("euclidean");
  const optimal = (key: "manhattan" | "euclidean") =>
    (key === "manhattan" ? mOpt : eOpt).reduce((s, x) => s + x, 0);
  // Its own seed, so the expansion interval above is unchanged by this one.
  const optimalDiff = pairedMeanDifference(mOpt, eOpt, { reps, seed: seed + 1 });
  const excess = (key: "manhattan" | "euclidean") =>
    withPath.length
      ? withPath.reduce((s, r) => s + (r[key].cells - r.optimalCells!), 0) / withPath.length
      : 0;
  const maxExcess = withPath.reduce(
    (mx, r) =>
      Math.max(mx, r.manhattan.cells - r.optimalCells!, r.euclidean.cells - r.optimalCells!),
    0,
  );
  const reference = 10;
  return {
    boards: rows.length,
    boardsWithPath: withPath.length,
    expansions: {
      meanManhattan: paired.meanX,
      meanEuclidean: paired.meanY,
      meanDiff: paired.meanDiff,
      medianDiff: median(diffs),
      dz: paired.dz,
      wilcoxon: wilcoxonSignedRank(m, e),
      manhattanFewer: diffs.filter((d) => d < 0).length,
      euclideanFewer: diffs.filter((d) => d > 0).length,
      ties: diffs.filter((d) => d === 0).length,
    },
    optimality: {
      manhattan: wilson(optimal("manhattan"), withPath.length),
      euclidean: wilson(optimal("euclidean"), withPath.length),
      agreement: wilson(
        withPath.filter((r) => r.manhattan.cells === r.euclidean.cells).length,
        withPath.length,
      ),
      difference: optimalDiff.meanDiff,
      mcnemar: mcnemarExact(
        mOpt.filter((x, i) => x === 1 && eOpt[i] === 0).length,
        mOpt.filter((x, i) => x === 0 && eOpt[i] === 1).length,
      ),
      manhattanExcess: excess("manhattan"),
      euclideanExcess: excess("euclidean"),
      maxExcess,
    },
    overestimation: { dimension: reference, ...overestimationRate(reference) },
  };
}

/** One row per board, for CSV export. */
export function pairedStudyCsvRows(rows: readonly PairedStudyRow[]) {
  return rows.map((r) => ({
    dimension: r.dimension,
    board: r.board,
    path_exists: r.optimalCells !== null,
    shortest_path_cells: r.optimalCells,
    manhattan_expansions: r.manhattan.expansions,
    euclidean_expansions: r.euclidean.expansions,
    diff_m_minus_e: r.manhattan.expansions - r.euclidean.expansions,
    manhattan_pops: r.manhattan.pops,
    euclidean_pops: r.euclidean.pops,
    manhattan_path_cells: r.manhattan.cells,
    euclidean_path_cells: r.euclidean.cells,
  }));
}
