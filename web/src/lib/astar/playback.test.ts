import { describe, expect, it } from "vitest";

import { astar } from "./astar";
import { parsePartAInput } from "./input";
import { searchFrame } from "./playback";
import { PRESETS } from "./presets";

describe("searchFrame", () => {
  const board = parsePartAInput(JSON.stringify(PRESETS[0].input));
  const result = astar(board, "manhattan");

  it("starts with only the start node open", () => {
    const f = searchFrame(result, board.n, board.start, 0);
    expect([...f.open]).toEqual([board.start[0] * board.n + board.start[1]]);
    expect(f.closed.size).toBe(0);
    expect(f.current).toBeNull();
  });

  it("ends with the same counters as the full search", () => {
    const f = searchFrame(result, board.n, board.start, Infinity);
    expect(f.done).toBe(true);
    expect(f.expanded).toBe(result.pops);
    expect(f.pushes).toBe(result.pushes);
  });
});
