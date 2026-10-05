import { describe, expect, it } from "vitest";

import { createRng } from "@/lib/rng";
import { randomNotebookBoard, runHeuristicBenchmark } from "./random-board";

describe("notebook random board generator", () => {
  it("produces distinct, empty start and goal cells", () => {
    const rng = createRng(42);
    for (let d = 2; d < 30; d++) {
      const board = randomNotebookBoard(d, rng);
      const { start, goal, cells, n } = board;
      expect(start).not.toEqual(goal);
      expect(cells[start[0] * n + start[1]]).toBeNull();
      expect(cells[goal[0] * n + goal[1]]).toBeNull();
      // at most (d*d - d) / 2 barriers
      expect(cells.filter(Boolean).length).toBeLessThanOrEqual(Math.floor((d * d - d) / 2));
    }
  });

  it("benchmark is reproducible for a seed", () => {
    const dims = [5, 10, 20];
    expect(runHeuristicBenchmark(dims, 3)).toEqual(runHeuristicBenchmark(dims, 3));
  });
});
