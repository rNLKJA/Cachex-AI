/**
 * Configurations of the precomputed reference studies (see
 * web/scripts/generate-reference-studies.ts). Kept in one place so the pages
 * can state exactly how each result was produced.
 */
import type { AgentId } from "@/lib/tournament/agents";

export const REFERENCE_TOURNAMENT_CONFIG = {
  agents: ["minimax-dynamic", "minimax-d2", "minimax-d3", "greedy", "random"] as AgentId[],
  sizes: [4, 5, 6],
  /** Colour-swapped pairs per pairing per size → 40 games per pairing per size. */
  rounds: 20,
  seed: 2022,
};

export const ASTAR_STUDY_CONFIG = {
  /** The notebook's range: every board size from 2 to 99. */
  dimensions: Array.from({ length: 98 }, (_, i) => i + 2),
  boardsPerDimension: 10,
  seed: 2022,
};

export const ALPHA_BETA_CONFIG = {
  sizes: [4, 5, 6],
  perSize: 40,
  depths: [2, 3],
  seed: 2022,
};
