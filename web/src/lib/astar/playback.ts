/**
 * Reconstruct the A* open/closed sets at any point of a recorded search, for
 * the step-by-step animation in the A* Lab.
 */
import type { Coord } from "@/lib/cachex/types";
import type { AStarResult } from "./astar";

export interface SearchFrame {
  /** Number of expansions shown (0 .. steps.length). */
  index: number;
  open: Set<number>;
  closed: Set<number>;
  current: number | null;
  expanded: number;
  pushes: number;
  done: boolean;
}

export function searchFrame(
  result: AStarResult,
  n: number,
  start: Coord,
  index: number,
): SearchFrame {
  const k = Math.max(0, Math.min(index, result.steps.length));
  const id = (c: Coord) => c[0] * n + c[1];
  const open = new Set<number>([id(start)]);
  const popped = new Set<number>();
  let pushes = 1;
  for (let i = 0; i < k; i++) {
    const step = result.steps[i];
    open.delete(id(step.node));
    popped.add(id(step.node));
    for (const c of step.pushed) open.add(id(c));
    pushes += step.pushed.length;
  }
  const closed = new Set([...popped].filter((x) => !open.has(x)));
  return {
    index: k,
    open,
    closed,
    current: k > 0 ? id(result.steps[k - 1].node) : null,
    expanded: k,
    pushes,
    done: k === result.steps.length,
  };
}
