/**
 * Typed loaders for the parity fixtures produced by
 * scripts/generate_parity_fixtures.py (which runs the ORIGINAL Python code).
 * Read with fs so tsc does not have to infer types for large JSON files.
 */
import { readFileSync } from "node:fs";

import type { Action, Colour } from "@/lib/cachex/types";

export type PyNumber = number | "inf" | "-inf";
export const fromPy = (x: PyNumber): number =>
  x === "inf" ? Infinity : x === "-inf" ? -Infinity : x;

export type PyAction = ["PLACE", number, number] | ["STEAL"];
export const toAction = (a: PyAction): Action => (a[0] === "STEAL" ? ["STEAL"] : ["PLACE", a[1], a[2]]);

function load<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), "utf8")) as T;
}

export interface PartAFixtures {
  meta: { python: string };
  neighbourOrders: Record<string, [number, number][][]>;
  cases: {
    name: string;
    input: { n: number; board: [string, number, number][]; start: [number, number]; goal: [number, number] };
    heuristic: "manhattan" | "euclidean";
    block: "Red" | "Blue" | null;
    path: [number, number][];
    pops: number;
    pushes: number;
  }[];
}

export type PositionRef = { game: number; cut: number } | { n: number; actions: PyAction[] };

interface ColourCountsPy {
  red: PyNumber;
  blue: PyNumber;
}

export interface PartBFixtures {
  meta: { python: string };
  scoreMatrices: Record<string, number[][]>;
  refereeGames: {
    n: number;
    actions: PyAction[];
    steps: { captures: [number, number][]; board: string; result: string | null }[];
  }[];
  evalPositions: {
    game: number;
    cut: number;
    features: {
      empty: number;
      triangle: ColourCountsPy;
      tokens: ColourCountsPy;
      location: ColourCountsPy;
      diamond: ColourCountsPy;
      weakness: ColourCountsPy;
    };
    eval: PyNumber;
  }[];
  minimax: {
    game: number;
    cut: number;
    depth: number;
    maximizing: boolean;
    score: PyNumber;
    action: PyAction | null;
  }[];
  agentMoves: (PositionRef & { colour: Colour; action: PyAction })[];
  agentGames: { n: number; actions: PyAction[]; result: string }[];
}

export const partA = () => load<PartAFixtures>("parity-part-a.json");
export const partB = () => load<PartBFixtures>("parity-part-b.json");

/** Resolve a (game, cut) reference to the board size and action prefix. */
export function position(
  fixtures: PartBFixtures,
  ref: PositionRef,
): { n: number; actions: Action[] } {
  if ("game" in ref) {
    const game = fixtures.refereeGames[ref.game];
    return { n: game.n, actions: game.actions.slice(0, ref.cut).map(toAction) };
  }
  return { n: ref.n, actions: ref.actions.map(toAction) };
}
