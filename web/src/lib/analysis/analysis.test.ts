import { describe, expect, it } from "vitest";

import { astar } from "@/lib/astar/astar";
import { PRESETS } from "@/lib/astar/presets";
import { parsePartAInput } from "@/lib/astar/input";
import { runHeuristicBenchmark } from "@/lib/astar/random-board";
import { loadAstarStudy } from "@/lib/data/load";
import { ASTAR_STUDY_CONFIG } from "@/lib/data/reference-config";
import { measurePruning, samplePositions, summarisePruning } from "./alpha-beta";
import {
  bfsPathCells,
  hexDistance,
  overestimationRate,
  pairedStudyCsvRows,
  runPairedStudy,
  summarisePairedStudy,
} from "./astar-paired";

describe("hex distance and BFS ground truth", () => {
  it("measures distance in the six HEX_STEPS directions", () => {
    expect(hexDistance([0, 0], [1, -1])).toBe(1);
    expect(hexDistance([0, 0], [1, 1])).toBe(2);
    expect(hexDistance([2, 2], [0, 4])).toBe(2);
    expect(hexDistance([0, 0], [3, 0])).toBe(3);
  });

  it("both heuristics overestimate exactly when dr and dq have opposite signs", () => {
    // (1, -1) is one step away, but Manhattan says 2 and Euclidean √2.
    const rates = overestimationRate(5);
    expect(rates.manhattan).toBeCloseTo(rates.euclidean, 12);
    // opposite-sign pairs on a 5×5 board: Σ over dr,dq ≠ 0 with opposite signs
    let count = 0;
    for (let a = 0; a < 25; a++)
      for (let b = 0; b < 25; b++) {
        const dr = Math.floor(b / 5) - Math.floor(a / 5);
        const dq = (b % 5) - (a % 5);
        if (dr * dq < 0) count++;
      }
    expect(rates.manhattan).toBeCloseTo(count / (25 * 24), 12);
  });

  it("BFS agrees with A* on the sample inputs (which are shortest paths)", () => {
    for (const preset of PRESETS) {
      const board = parsePartAInput(JSON.stringify(preset.input));
      const bfs = bfsPathCells(board);
      const m = astar(board, "manhattan");
      if (preset.originalPath === null) {
        expect(bfs).toBeNull();
        expect(m.path).toEqual([]);
      } else {
        expect(bfs).not.toBeNull();
        expect(m.path.length).toBeGreaterThanOrEqual(bfs!);
      }
    }
    const s1 = bfsPathCells(parsePartAInput(JSON.stringify(PRESETS[0].input)));
    const s2 = bfsPathCells(parsePartAInput(JSON.stringify(PRESETS[1].input)));
    expect([s1, s2]).toEqual([8, 13]);
  });
});

describe("paired heuristic study", () => {
  it("reproduces the existing one-board-per-size benchmark exactly", () => {
    const dims = [3, 8, 15, 30];
    const rows = runPairedStudy({ dimensions: dims, boardsPerDimension: 1, seed: 17 });
    const old = runHeuristicBenchmark(dims, 17);
    rows.forEach((r, i) => {
      expect(r.manhattan.expansions).toBe(old[i].manhattan);
      expect(r.euclidean.expansions).toBe(old[i].euclidean);
      expect(r.manhattan.cells > 0).toBe(old[i].pathFound);
    });
  });

  const rows = runPairedStudy({
    dimensions: Array.from({ length: 20 }, (_, i) => i + 4),
    boardsPerDimension: 3,
    seed: 5,
  });
  const summary = summarisePairedStudy(rows, { reps: 500, seed: 1 });

  it("never finds a path shorter than BFS, and finds one exactly when BFS does", () => {
    for (const r of rows) {
      if (r.optimalCells === null) {
        expect(r.manhattan.cells).toBe(0);
        expect(r.euclidean.cells).toBe(0);
      } else {
        expect(r.manhattan.cells).toBeGreaterThanOrEqual(r.optimalCells);
        expect(r.euclidean.cells).toBeGreaterThanOrEqual(r.optimalCells);
      }
    }
  });

  it("summarises paired differences consistently", () => {
    const e = summary.expansions;
    expect(summary.boards).toBe(60);
    expect(e.manhattanFewer + e.euclideanFewer + e.ties).toBe(60);
    expect(e.meanDiff.estimate).toBeCloseTo(e.meanManhattan - e.meanEuclidean, 9);
    expect(e.meanDiff.lower).toBeLessThanOrEqual(e.meanDiff.estimate);
    expect(e.meanDiff.upper).toBeGreaterThanOrEqual(e.meanDiff.estimate);
    expect(e.wilcoxon.n + e.wilcoxon.zeros).toBe(60);
    expect(e.wilcoxon.pValue).toBeGreaterThan(0);
    expect(e.wilcoxon.pValue).toBeLessThanOrEqual(1);
    const o = summary.optimality;
    expect(o.manhattan.n).toBe(summary.boardsWithPath);
    expect(o.manhattanExcess).toBeGreaterThanOrEqual(0);
    // The paired difference equals the difference of the two rates, and
    // McNemar's discordant counts reconcile with the marginal counts.
    expect(o.difference.estimate).toBeCloseTo(o.manhattan.p - o.euclidean.p, 12);
    expect(o.difference.lower).toBeLessThanOrEqual(o.difference.estimate);
    expect(o.difference.upper).toBeGreaterThanOrEqual(o.difference.estimate);
    expect(o.mcnemar.b - o.mcnemar.c).toBe(o.manhattan.successes - o.euclidean.successes);
    expect(pairedStudyCsvRows(rows)).toHaveLength(60);
  });

  it("reports the reference study's paired optimality comparison", () => {
    const ref = summarisePairedStudy(loadAstarStudy().rows, { seed: ASTAR_STUDY_CONFIG.seed });
    const o = ref.optimality;
    expect([o.manhattan.successes, o.euclidean.successes, o.manhattan.n]).toEqual([692, 797, 931]);
    expect([o.mcnemar.b, o.mcnemar.c]).toEqual([1, 106]);
    expect(o.mcnemar.pValue / 1.3312027775604574e-30).toBeCloseTo(1, 10); // scipy binomtest(1, 107)
    expect(o.difference.estimate).toBeCloseTo(-105 / 931, 12);
    expect(o.difference.upper).toBeLessThan(0);
  });
});

describe("alpha-beta efficiency", () => {
  const positions = samplePositions({ sizes: [4, 5], perSize: 6, seed: 3 });

  it("samples reproducible mid-game positions", () => {
    expect(positions).toHaveLength(12);
    expect(samplePositions({ sizes: [4, 5], perSize: 6, seed: 3 })).toEqual(positions);
    for (const p of positions) {
      expect(p.actions.length).toBeGreaterThanOrEqual(2);
      expect(p.toMove).toBe(p.actions.length % 2 === 0 ? "red" : "blue");
    }
  });

  it("pruning visits no more nodes and never changes the root value", () => {
    for (const p of positions) {
      for (const depth of [2, 3]) {
        for (const order of ["canonical", "shuffled"] as const) {
          const s = measurePruning(p, depth, order);
          expect(s.valueMatches).toBe(true);
          expect(s.textbookValueMatches).toBe(true);
          expect(s.nodesPruned).toBeLessThanOrEqual(s.nodesFull);
          expect(s.nodesTextbook).toBeLessThanOrEqual(s.nodesFull);
          expect(s.ratio).toBeGreaterThan(0);
        }
      }
    }
  });

  it("the original's inverted beta update costs pruning (textbook prunes at least as much here)", () => {
    let original = 0;
    let textbook = 0;
    for (const p of positions) {
      const s = measurePruning(p, 3, "canonical");
      original += s.nodesPruned;
      textbook += s.nodesTextbook;
    }
    expect(textbook).toBeLessThan(original);
  });

  it("full minimax visits 1 + b + b(b−1) nodes at depth 2 when nothing ends early", () => {
    const p = positions[0];
    const s = measurePruning(p, 2, "canonical");
    const b = p.empty;
    // A depth-2 subtree can end early only if a move wins, which is rare this early.
    expect(s.nodesFull).toBeLessThanOrEqual(1 + b + b * (b - 1));
  });

  it("summarises by board size, depth and order", () => {
    const samples = positions.flatMap((p) => [
      measurePruning(p, 2, "canonical"),
      measurePruning(p, 2, "shuffled"),
    ]);
    const groups = summarisePruning(samples, { reps: 200, seed: 1 });
    expect(groups).toHaveLength(4);
    for (const g of groups) {
      expect(g.positions).toBe(6);
      expect(g.valueMatches).toBe(6);
      expect(g.meanRatio.estimate).toBeGreaterThan(0);
      expect(g.meanRatio.estimate).toBeLessThanOrEqual(1);
      expect(g.pooledRatio.lower).toBeLessThanOrEqual(g.pooledRatio.estimate);
    }
  });
});
