import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

const CODE_DIR = fileURLToPath(
  new URL("../../../../coursework/Project Part A/code/", import.meta.url),
);

/** Parse a recorded sample_output*.txt: a length line, then "(r, q)" per line. */
function readRecordedOutput(file: string) {
  const [count, ...lines] = readFileSync(resolve(CODE_DIR, file), "utf8").trim().split(/\r?\n/);
  const path = lines.map((l) => {
    const m = /^\((\d+),\s*(\d+)\)$/.exec(l.trim());
    if (!m) throw new Error(`unexpected line in ${file}: ${l}`);
    return [Number(m[1]), Number(m[2])];
  });
  expect(path).toHaveLength(Number(count));
  return path;
}

describe("original recorded outputs", () => {
  it.each([
    ["sample_input.json", "sample_output.txt", "sample-1"],
    ["sample_input2.json", "sample_output2.txt", "sample-2"],
  ])("%s → %s, read from coursework/, for both heuristics", (input, output, presetId) => {
    const recorded = readRecordedOutput(output);
    const board = parsePartAInput(readFileSync(resolve(CODE_DIR, input), "utf8"));
    const preset = PRESETS.find((p) => p.id === presetId)!;
    expect(parsePartAInput(JSON.stringify(preset.input))).toEqual(board);
    expect(preset.originalPath).toEqual(recorded);
    expect(preset.originalHeuristic).toBe("manhattan");
    for (const heuristic of ["manhattan", "euclidean"] as const) {
      expect(astar(board, heuristic).path, heuristic).toEqual(recorded);
    }
  });

  it("CLI output format (search/main.py) for sample_input.json", () => {
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
