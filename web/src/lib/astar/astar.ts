/**
 * Port of `CachexBoard.AStar` (coursework/Project Part A/code/cachex/CachexBoard.py)
 * with the Minkowski heuristics from `HexNode.distance_diff`.
 *
 * Faithful details that affect the output:
 *  - the open set is a priority queue of [f, insert_order, node]; a node whose
 *    g improves while it is still queued keeps its old f in the queue;
 *  - closed nodes can be re-opened if a cheaper route to them is found;
 *  - neighbours are visited in CPython set-iteration order (see python-set-order.ts).
 *
 * The port additionally records a trace of every expansion for the A* Lab.
 */
import type { Colour, Coord } from "@/lib/cachex/types";
import { PriorityQueue } from "./priority-queue";
import { pythonNeighbourOrder } from "./python-set-order";

export type Heuristic = "manhattan" | "euclidean";
/** Which colour's tiles block the search; null means every tile blocks (the CLI default). */
export type BlockMode = Colour | null;
export type CellState = Colour | null;

export interface AStarBoard {
  n: number;
  /** Row-major cell states: index r * n + q. */
  cells: CellState[];
  start: Coord;
  goal: Coord;
}

export interface AStarStep {
  /** The node popped from the priority queue. */
  node: Coord;
  /** g-score of the node when it was popped. */
  g: number;
  /** f-score it was queued with. */
  f: number;
  /** Nodes newly pushed onto the queue while expanding this node. */
  pushed: Coord[];
  /** Nodes whose g improved while they were already queued. */
  improved: Coord[];
}

export interface AStarResult {
  /** Start-to-goal path (inclusive), or [] when the goal is unreachable. */
  path: Coord[];
  /** Priority-queue pops (node expansions, including the goal). */
  pops: number;
  /** Priority-queue pushes (including the start node). */
  pushes: number;
  steps: AStarStep[];
}

export const HEURISTIC_P: Record<Heuristic, number> = { manhattan: 1, euclidean: 2 };

/** `HexNode.minkowski` */
export function minkowski(a: Coord, b: Coord, p: number): number {
  return Math.pow(Math.pow(Math.abs(a[0] - b[0]), p) + Math.pow(Math.abs(a[1] - b[1]), p), 1 / p);
}

export function distanceDiff(a: Coord, b: Coord, heuristic: Heuristic): number {
  return minkowski(a, b, HEURISTIC_P[heuristic]);
}

export class AStarInputError extends Error {}

export function validateBoard(board: AStarBoard): void {
  const { n, start, goal, cells } = board;
  if (!Number.isInteger(n) || n < 1) throw new AStarInputError("n must be a positive integer");
  if (cells.length !== n * n) throw new AStarInputError("cells must have n × n entries");
  // The original only checks the upper bound (InvalidStartError / InvalidGoalError).
  const inside = ([r, q]: Coord) => r >= 0 && q >= 0 && r < n && q < n;
  if (!inside(start))
    throw new AStarInputError("Current start point out of board existing board dimension.");
  if (!inside(goal))
    throw new AStarInputError("Current goal point out of board existing board dimension.");
}

export function astar(
  board: AStarBoard,
  heuristic: Heuristic,
  block: BlockMode = null,
): AStarResult {
  validateBoard(board);
  const { n, cells, start, goal } = board;
  const id = (c: Coord) => c[0] * n + c[1];
  const coordOf = (i: number): Coord => [Math.floor(i / n), i % n];

  const traversable = (i: number) => (block !== null ? cells[i] !== block : cells[i] === null);

  // With no block colour, only empty cells get a score entry; a non-empty start
  // raises a KeyError in the original.
  if (block === null && cells[id(start)] !== null) {
    throw new AStarInputError("The start cell must be empty when every tile blocks the search.");
  }

  const g = new Float64Array(n * n).fill(Infinity);
  const h = new Float64Array(n * n).fill(Infinity);
  const f = new Float64Array(n * n).fill(Infinity);

  const queue = new PriorityQueue<number>();
  const explored = new Map<number, number>();
  const tracker = new Set<number>([id(start)]);
  let insertOrder = 0;
  let pushes = 0;
  let pops = 0;
  const steps: AStarStep[] = [];

  queue.put({ f: 0, order: insertOrder, value: id(start) });
  pushes++;
  g[id(start)] = 0;
  h[id(start)] = distanceDiff(start, goal, heuristic);

  const goalId = id(goal);

  while (!queue.empty()) {
    const item = queue.get();
    pops++;
    const current = item.value;
    tracker.delete(current);
    const step: AStarStep = {
      node: coordOf(current),
      g: g[current],
      f: item.f,
      pushed: [],
      improved: [],
    };
    steps.push(step);

    if (current === goalId) {
      const path: number[] = [];
      let node = current;
      while (explored.has(node)) {
        node = explored.get(node)!;
        path.push(node);
      }
      path.unshift(goalId);
      return { path: path.reverse().map(coordOf), pops, pushes, steps };
    }

    const [r, q] = coordOf(current);
    for (const next of pythonNeighbourOrder(n, r, q)) {
      const ni = id(next);
      if (!traversable(ni)) continue;
      if (g[current] + 1 < g[ni]) {
        g[ni] = g[current] + 1;
        h[ni] = distanceDiff(next, goal, heuristic);
        f[ni] = g[ni] + h[ni];
        explored.set(ni, current);
        if (!tracker.has(ni)) {
          insertOrder++;
          queue.put({ f: f[ni], order: insertOrder, value: ni });
          pushes++;
          tracker.add(ni);
          step.pushed.push(next);
        } else {
          step.improved.push(next);
        }
      }
    }
  }

  return { path: [], pops, pushes, steps };
}

/** Output in the original CLI format: the path length, then one "(r,q)" per line. */
export function formatCliOutput(path: readonly Coord[]): string {
  return [String(path.length), ...path.map(([r, q]) => `(${r},${q})`)].join("\n");
}
