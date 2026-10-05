import { describe, expect, it } from "vitest";

import { partA } from "@/lib/__fixtures__/load";
import { AStarInputError, astar, distanceDiff, formatCliOutput } from "./astar";
import { parsePartAInput, stringifyPartAInput } from "./input";
import { PRESETS } from "./presets";
import { pythonNeighbourOrder, pythonTupleHash, toSigned64 } from "./python-set-order";

const fixtures = partA();
const blockOf = (b: "Red" | "Blue" | null) => (b === null ? null : b === "Red" ? "red" : "blue");

describe("CPython set-order simulation", () => {
  it("reproduces hash((r, q)) from CPython", () => {
    // values printed by CPython 3.12
    expect(toSigned64(pythonTupleHash([2, 3]))).toBe(8409376899596376432n);
    expect(toSigned64(pythonTupleHash([0, 0]))).toBe(-8458139203682520985n);
  });

  it("matches HexNode.next iteration order for every cell, n = 1..14", () => {
    for (const [nKey, cells] of Object.entries(fixtures.neighbourOrders)) {
      const n = Number(nKey);
      cells.forEach((expected, i) => {
        const r = Math.floor(i / n);
        const q = i % n;
        expect(pythonNeighbourOrder(n, r, q), `n=${n} (${r},${q})`).toEqual(expected);
      });
    }
  });
});

describe("A* parity with the original CachexBoard.AStar", () => {
  it.each(
    fixtures.cases.map((c, i) => [`${c.name} ${c.heuristic} block=${c.block} #${i}`, c] as const),
  )("%s", (_, c) => {
    const board = parsePartAInput(JSON.stringify(c.input));
    const result = astar(board, c.heuristic, blockOf(c.block));
    expect(result.path).toEqual(c.path);
    expect(result.pops).toBe(c.pops);
    expect(result.pushes).toBe(c.pushes);
  });

  it("covers reachable and unreachable goals", () => {
    expect(fixtures.cases.some((c) => c.path.length === 0)).toBe(true);
    expect(fixtures.cases.some((c) => c.path.length > 8)).toBe(true);
  });
});

describe("original recorded outputs", () => {
  it("sample_input.json → sample_output.txt (8 cells)", () => {
    const preset = PRESETS.find((p) => p.id === "sample-1")!;
    const result = astar(parsePartAInput(JSON.stringify(preset.input)), "euclidean");
    expect(formatCliOutput(result.path)).toBe(
      ["8", "(4,2)", "(4,1)", "(3,1)", "(2,1)", "(1,2)", "(0,2)", "(0,1)", "(0,0)"].join("\n"),
    );
  });

  it.each(PRESETS.map((p) => [p.label, p] as const))(
    "%s matches the recorded path",
    (_, preset) => {
      const result = astar(
        parsePartAInput(JSON.stringify(preset.input)),
        preset.originalHeuristic ?? "euclidean",
      );
      expect(result.path).toEqual(preset.originalPath ?? []);
    },
  );
});

describe("heuristics", () => {
  it("Manhattan and Euclidean follow the Minkowski formula", () => {
    expect(distanceDiff([0, 0], [3, 4], "manhattan")).toBe(7);
    expect(distanceDiff([0, 0], [3, 4], "euclidean")).toBe(5);
  });
});

describe("input format", () => {
  it("round-trips the original JSON format", () => {
    const text = JSON.stringify(PRESETS[1].input);
    const board = parsePartAInput(text);
    expect(parsePartAInput(stringifyPartAInput(board))).toEqual(board);
  });

  it("rejects malformed input with a helpful message", () => {
    expect(() => parsePartAInput("{")).toThrow(AStarInputError);
    expect(() => parsePartAInput('{"n": 3, "start": [0, 0]}')).toThrow(/goal/);
    expect(() =>
      parsePartAInput('{"n": 3, "board": [["b", 5, 0]], "start": [0,0], "goal": [1,1]}'),
    ).toThrow(/outside/);
  });

  it("refuses an occupied start when every tile blocks (KeyError in the original)", () => {
    const board = parsePartAInput(
      '{"n": 3, "board": [["r", 0, 0]], "start": [0, 0], "goal": [2, 2]}',
    );
    expect(() => astar(board, "manhattan", null)).toThrow(AStarInputError);
    expect(astar(board, "manhattan", "blue").path.length).toBeGreaterThan(0);
  });
});
