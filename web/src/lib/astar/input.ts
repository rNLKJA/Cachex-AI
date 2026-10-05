/**
 * Read and write the original Part A input format (sample_input.json):
 *
 *   { "n": 5, "board": [["b", 1, 0], ["r", 3, 2]], "start": [4, 2], "goal": [0, 0] }
 */
import type { Coord } from "@/lib/cachex/types";
import { AStarInputError, type AStarBoard, type CellState } from "./astar";

export interface PartAInput {
  n: number;
  board: [string, number, number][];
  start: [number, number];
  goal: [number, number];
}

const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
const isPair = (x: unknown): x is [number, number] =>
  Array.isArray(x) && x.length === 2 && isInt(x[0]) && isInt(x[1]);

export function parsePartAInput(text: string): AStarBoard {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AStarInputError("That isn't valid JSON.");
  }
  if (typeof raw !== "object" || raw === null) throw new AStarInputError("Expected a JSON object.");
  const data = raw as Record<string, unknown>;
  if (!isInt(data.n) || data.n < 1) throw new AStarInputError('"n" must be a positive integer.');
  if (data.n > 30)
    throw new AStarInputError("Boards larger than 30 × 30 are not supported in the lab.");
  if (!isPair(data.start)) throw new AStarInputError('"start" must be a pair [r, q].');
  if (!isPair(data.goal)) throw new AStarInputError('"goal" must be a pair [r, q].');
  const n = data.n;
  const board = data.board ?? [];
  if (!Array.isArray(board))
    throw new AStarInputError('"board" must be a list of [colour, r, q] entries.');

  const cells: CellState[] = new Array(n * n).fill(null);
  for (const entry of board) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 3 ||
      typeof entry[0] !== "string" ||
      !isInt(entry[1]) ||
      !isInt(entry[2])
    ) {
      throw new AStarInputError('Each board entry must look like ["b", r, q].');
    }
    const [colour, r, q] = entry as [string, number, number];
    if (r < 0 || q < 0 || r >= n || q >= n) {
      throw new AStarInputError(`Board entry (${r}, ${q}) is outside an n = ${n} board.`);
    }
    const c = colour.toLowerCase();
    if (c === "r") cells[r * n + q] = "red";
    else if (c === "b") cells[r * n + q] = "blue";
  }

  return { n, cells, start: data.start as Coord, goal: data.goal as Coord };
}

export function toPartAInput(board: AStarBoard): PartAInput {
  const entries: [string, number, number][] = [];
  board.cells.forEach((cell, i) => {
    if (cell !== null)
      entries.push([cell === "red" ? "r" : "b", Math.floor(i / board.n), i % board.n]);
  });
  return {
    n: board.n,
    board: entries,
    start: [board.start[0], board.start[1]],
    goal: [board.goal[0], board.goal[1]],
  };
}

/** Pretty JSON in the same shape as the original sample files. */
export function stringifyPartAInput(board: AStarBoard): string {
  const input = toPartAInput(board);
  const tiles = input.board.map((t) => `    ${JSON.stringify(t).replace(/,/g, ", ")}`).join(",\n");
  return [
    "{",
    `  "n": ${input.n},`,
    `  "board": [${tiles ? `\n${tiles}\n  ` : ""}],`,
    `  "start": [${input.start.join(", ")}],`,
    `  "goal": [${input.goal.join(", ")}]`,
    "}",
  ].join("\n");
}
