import { describe, expect, it } from "vitest";

import { HEX_STEPS } from "./cachex/board";
import { SQRT3, boardGeometry } from "./hex-geometry";

describe("board geometry", () => {
  const g = boardGeometry(5, 10);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it("places every hex neighbour exactly one hex-width away", () => {
    for (const [dr, dq] of HEX_STEPS) {
      expect(dist(g.centre(2, 2), g.centre(2 + dr, 2 + dq))).toBeCloseTo(SQRT3 * 10, 6);
    }
  });

  it("draws row 0 at the bottom with rows shifting right as they go up", () => {
    expect(g.centre(0, 0).y).toBeGreaterThan(g.centre(4, 0).y);
    expect(g.centre(4, 0).x).toBeGreaterThan(g.centre(0, 0).x);
  });

  it("keeps every hex inside the viewBox", () => {
    for (let r = 0; r < 5; r++) {
      for (let q = 0; q < 5; q++) {
        const c = g.centre(r, q);
        expect(c.x - 10).toBeGreaterThanOrEqual(0);
        expect(c.x + 10).toBeLessThanOrEqual(g.width);
        expect(c.y - 10).toBeGreaterThanOrEqual(0);
        expect(c.y + 10).toBeLessThanOrEqual(g.height);
      }
    }
  });

  it("builds edge polylines whose ends meet at the corners", () => {
    const { top, right, bottom, left } = g.edges;
    expect(dist(top[top.length - 1], right[0])).toBeCloseTo(0, 6);
    expect(dist(right[right.length - 1], bottom[bottom.length - 1])).toBeCloseTo(0, 6);
    expect(dist(left[0], bottom[0])).toBeCloseTo(0, 6);
    expect(dist(left[left.length - 1], top[0])).toBeCloseTo(0, 6);
  });
});
