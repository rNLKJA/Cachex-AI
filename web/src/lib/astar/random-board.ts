/**
 * Port of the random board generator used for the heuristic study in
 * "Part A Testing Nodebook.ipynb", plus the benchmark loop that compares
 * Manhattan and Euclidean node expansions.
 */
import type { Coord } from "@/lib/cachex/types";
import { type Rng, createRng, randInt, sample } from "@/lib/rng";
import { type AStarBoard, type CellState, astar } from "./astar";

/**
 * barriers = sample(nodes, randint(0, d*d - d)); barriers = sample(barriers, len // divisor);
 * start/goal are distinct non-barrier cells. Barriers are blue tiles.
 */
export function randomNotebookBoard(dimension: number, rng: Rng, divisor = 2): AStarBoard {
  const nodes: Coord[] = [];
  for (let r = 0; r < dimension; r++) for (let q = 0; q < dimension; q++) nodes.push([r, q]);

  let barriers = sample(rng, nodes, randInt(rng, 0, dimension * dimension - dimension));
  barriers = sample(rng, barriers, Math.floor(barriers.length / divisor));
  const blocked = new Set(barriers.map(([r, q]) => r * dimension + q));

  const free = nodes.filter(([r, q]) => !blocked.has(r * dimension + q));
  const [start] = sample(rng, free, 1);
  const [goal] = sample(
    rng,
    free.filter((c) => c !== start),
    1,
  );

  const cells: CellState[] = new Array(dimension * dimension).fill(null);
  for (const i of blocked) cells[i] = "blue";
  return { n: dimension, cells, start, goal };
}

export interface BenchmarkRow {
  dimension: number;
  manhattan: number;
  euclidean: number;
  pathFound: boolean;
}

/** Node expansions (queue pops) for each heuristic on one random board per dimension. */
export function runHeuristicBenchmark(dimensions: readonly number[], seed: number): BenchmarkRow[] {
  const rng = createRng(seed);
  return dimensions.map((dimension) => {
    const board = randomNotebookBoard(dimension, rng);
    const m = astar(board, "manhattan");
    const e = astar(board, "euclidean");
    return { dimension, manhattan: m.pops, euclidean: e.pops, pathFound: m.path.length > 0 };
  });
}
