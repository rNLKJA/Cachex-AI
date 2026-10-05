/**
 * Boards from the original repository: the two sample inputs shipped with
 * Part A (and their recorded outputs), plus the group-defined test boards from
 * "Part A Testing Nodebook.ipynb".
 */
import type { Coord } from "@/lib/cachex/types";
import type { Heuristic } from "./astar";
import type { PartAInput } from "./input";

export interface Preset {
  id: string;
  label: string;
  source: string;
  input: PartAInput;
  /** Path recorded in the original repo, if any. */
  originalPath?: Coord[] | null;
  /** Heuristic used when the original output was recorded. */
  originalHeuristic?: Heuristic;
}

const BASE: [string, number, number][] = [
  ["b", 1, 0],
  ["b", 1, 1],
  ["b", 3, 2],
  ["b", 1, 3],
];

const c = (pairs: [number, number][]): Coord[] => pairs;

export const PRESETS: readonly Preset[] = [
  {
    id: "sample-1",
    label: "Sample input 1",
    // sample_output.txt was written by notebook cell 5 with heuristic="manhattan".
    source: "code/sample_input.json → sample_output.txt",
    input: { n: 5, board: BASE, start: [4, 2], goal: [0, 0] },
    originalPath: c([
      [4, 2],
      [4, 1],
      [3, 1],
      [2, 1],
      [1, 2],
      [0, 2],
      [0, 1],
      [0, 0],
    ]),
    originalHeuristic: "manhattan",
  },
  {
    id: "sample-2",
    label: "Sample input 2",
    // sample_output2.txt matches notebook cell 14, which also uses "manhattan".
    source: "code/sample_input2.json → sample_output2.txt",
    input: {
      n: 5,
      board: [
        ["b", 3, 1],
        ["b", 3, 2],
        ["b", 3, 3],
        ["b", 3, 4],
        ["b", 1, 0],
        ["b", 1, 1],
        ["b", 1, 2],
        ["b", 1, 3],
      ],
      start: [4, 2],
      goal: [0, 0],
    },
    originalPath: c([
      [4, 2],
      [4, 1],
      [4, 0],
      [3, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [1, 4],
      [0, 4],
      [0, 3],
      [0, 2],
      [0, 1],
      [0, 0],
    ]),
    originalHeuristic: "manhattan",
  },
  {
    id: "notebook-short",
    label: "Notebook: short hop",
    source: "Part A Testing Nodebook.ipynb",
    input: { n: 5, board: BASE, start: [4, 2], goal: [1, 4] },
    originalPath: c([
      [4, 2],
      [3, 3],
      [2, 4],
      [1, 4],
    ]),
    originalHeuristic: "manhattan",
  },
  {
    id: "notebook-diagonal",
    label: "Notebook: corner to corner",
    source: "Part A Testing Nodebook.ipynb",
    input: { n: 5, board: BASE, start: [4, 0], goal: [0, 4] },
    originalPath: c([
      [4, 0],
      [3, 1],
      [2, 2],
      [1, 2],
      [0, 3],
      [0, 4],
    ]),
    originalHeuristic: "manhattan",
  },
  {
    id: "notebook-detour",
    label: "Notebook: forced detour",
    source: "Part A Testing Nodebook.ipynb",
    input: { n: 5, board: [...BASE, ["b", 0, 3]], start: [0, 0], goal: [0, 4] },
    originalPath: c([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [2, 3],
      [1, 4],
      [0, 4],
    ]),
    originalHeuristic: "manhattan",
  },
  {
    id: "notebook-blocked",
    label: "Notebook: no path",
    source: "Part A Testing Nodebook.ipynb",
    input: { n: 5, board: [...BASE, ["b", 0, 3], ["b", 1, 2]], start: [4, 0], goal: [0, 0] },
    originalPath: null,
    originalHeuristic: "manhattan",
  },
];

export const DEFAULT_PRESET = PRESETS[0];
