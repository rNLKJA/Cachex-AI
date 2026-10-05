/**
 * Port of `Eval` (coursework/Project Part B/code/utility/evaluation.py).
 *
 * The score is from Red's point of view: Red maximises, Blue minimises.
 * Weights come from a verbatim copy of the original `utility/weights.json`.
 */
import type { AgentBoard } from "./agent-board";
import {
  type ColourCounts,
  countTokenInDiamond,
  countTokenInDiffHexLocation,
  countTokenInTriangle,
  countTokenInWeakness,
  nEmptyHex,
  tokenCounter,
} from "./features";
import weightsFile from "./weights.json";

export const MAGIC_NUMBER = 1e-5;

export const POSITIVE_WEIGHTS: readonly number[] = weightsFile[0].positive_weights!;
export const NEGATIVE_WEIGHTS: readonly number[] = weightsFile[1].negative_weights!;

export type FeatureId = "empty" | "triangle" | "tokens" | "location" | "diamond" | "weakness";

export interface FeatureSpec {
  id: FeatureId;
  label: string;
  description: string;
  sign: 1 | -1;
  weight: number;
}

export const FEATURES: readonly FeatureSpec[] = [
  {
    id: "empty",
    label: "Empty hexes",
    description: "Number of empty cells left on the board (shared, not per colour).",
    sign: 1,
    weight: POSITIVE_WEIGHTS[0],
  },
  {
    id: "triangle",
    label: "Triangle formations",
    description: "Tokens that form a solid triangle with two adjacent friendly neighbours.",
    sign: 1,
    weight: POSITIVE_WEIGHTS[1],
  },
  {
    id: "tokens",
    label: "Token count",
    description: "Tokens of each colour currently on the board.",
    sign: 1,
    weight: POSITIVE_WEIGHTS[2],
  },
  {
    id: "location",
    label: "Positional value",
    description: "Sum of cell scores: the rim scores higher than the centre.",
    sign: 1,
    weight: POSITIVE_WEIGHTS[3],
  },
  {
    id: "diamond",
    label: "Capturable diamonds",
    description: "Tokens sitting in a half-built diamond the opponent could complete.",
    sign: -1,
    weight: NEGATIVE_WEIGHTS[0],
  },
  {
    id: "weakness",
    label: "Weak formations",
    description: "Tokens with an exposed gap that invites an attack.",
    sign: -1,
    weight: NEGATIVE_WEIGHTS[1],
  },
];

export interface Features {
  empty: number;
  triangle: ColourCounts;
  tokens: ColourCounts;
  location: ColourCounts;
  diamond: ColourCounts;
  weakness: ColourCounts;
}

export function computeFeatures(board: AgentBoard): Features {
  return {
    empty: nEmptyHex(board),
    triangle: countTokenInTriangle(board),
    tokens: tokenCounter(board),
    location: countTokenInDiffHexLocation(board),
    diamond: countTokenInDiamond(board),
    weakness: countTokenInWeakness(board),
  };
}

/** Weighted score of the features, before the random tie-break bias. */
export function scoreFeatures(f: Features): number {
  let score = 0;
  // positive features: Red adds, Blue subtracts
  score += f.empty * POSITIVE_WEIGHTS[0];
  score += f.triangle.red * POSITIVE_WEIGHTS[1];
  score -= f.triangle.blue * POSITIVE_WEIGHTS[1];
  score += f.tokens.red * POSITIVE_WEIGHTS[2];
  score -= f.tokens.blue * POSITIVE_WEIGHTS[2];
  score += f.location.red * POSITIVE_WEIGHTS[3];
  score -= f.location.blue * POSITIVE_WEIGHTS[3];
  // negative features: Red subtracts, Blue adds
  score -= f.diamond.red * NEGATIVE_WEIGHTS[0];
  score += f.diamond.blue * NEGATIVE_WEIGHTS[0];
  score -= f.weakness.red * NEGATIVE_WEIGHTS[1];
  score += f.weakness.blue * NEGATIVE_WEIGHTS[1];
  return score;
}

export interface FeatureContribution extends FeatureSpec {
  red: number | null;
  blue: number | null;
  value: number | null;
  contribution: number;
}

/** Per-feature breakdown used by the "explain move" panel. */
export function explainFeatures(f: Features): FeatureContribution[] {
  return FEATURES.map((spec) => {
    if (spec.id === "empty") {
      return {
        ...spec,
        red: null,
        blue: null,
        value: f.empty,
        contribution: f.empty * spec.weight,
      };
    }
    const c = f[spec.id];
    return {
      ...spec,
      red: c.red,
      blue: c.blue,
      value: null,
      contribution: spec.sign * (c.red - c.blue) * spec.weight,
    };
  });
}

/**
 * `apply_bias`: multiply by 1 or 1 + 1e-5 at random so equal evaluations are
 * broken differently from game to game.
 */
export type BiasFn = () => number;
export const noBias: BiasFn = () => 1;
export const randomBias =
  (rng: () => number): BiasFn =>
  () =>
    (rng() < 0.5 ? 0 : 1) * MAGIC_NUMBER + 1;

/** `Eval(board, player)` — the player argument is unused in the original. */
export function evaluate(board: AgentBoard, bias: BiasFn = noBias): number {
  return scoreFeatures(computeFeatures(board)) * bias();
}
