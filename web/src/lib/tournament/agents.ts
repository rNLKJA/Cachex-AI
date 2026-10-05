/**
 * The agents in the round-robin harness. Every minimax variant is the ported
 * `_4399` agent with exactly one knob changed, so a difference in results can
 * be attributed to that knob:
 *
 *  - minimax-dynamic: the original as submitted (dynamic depth 1 to 4);
 *  - minimax-d2 / minimax-d3: the same agent with the depth fixed;
 *  - greedy: no opening book and depth fixed at 1 (the instant-win check is
 *    kept), i.e. one-ply lookahead on the hand-tuned evaluation;
 *  - random: the subject's random baseline.
 *
 * The same variants are built from the original Python in
 * scripts/crosscheck_tournament.py by patching `dynamic_depth_allocation`
 * and passing `enforceGamePlayer=False`.
 */
import { randomBias } from "@/lib/agent/evaluation";
import { type AgentDecision, type AgentOptions, chooseAgentAction } from "@/lib/agent/player";
import { chooseRandomAction } from "@/lib/agent/random-player";
import type { Action, Colour } from "@/lib/cachex/types";
import type { Rng } from "@/lib/rng";

export const AGENT_IDS = [
  "minimax-dynamic",
  "minimax-d2",
  "minimax-d3",
  "greedy",
  "random",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export interface TournamentAgent {
  id: AgentId;
  label: string;
  short: string;
  description: string;
  /** What changes relative to the original agent. */
  knob: string;
  /** Largest board the in-browser harness offers this agent on (search cost). */
  maxLiveN: number;
  options: AgentOptions | null;
}

export const AGENTS: Record<AgentId, TournamentAgent> = {
  "minimax-dynamic": {
    id: "minimax-dynamic",
    label: "Minimax, dynamic depth (original)",
    short: "Original",
    description:
      "The _4399 agent as submitted: opening book, instant-win check, then alpha-beta search whose depth grows from 1 to 4 as the board fills.",
    knob: "none (as submitted)",
    maxLiveN: 8,
    options: {},
  },
  "minimax-d2": {
    id: "minimax-d2",
    label: "Minimax, fixed depth 2",
    short: "Depth 2",
    description: "The same agent, searching two plies on every move.",
    knob: "depth fixed at 2",
    maxLiveN: 7,
    options: { fixedDepth: 2 },
  },
  "minimax-d3": {
    id: "minimax-d3",
    label: "Minimax, fixed depth 3",
    short: "Depth 3",
    description: "The same agent, searching three plies on every move. Slow above 5 × 5.",
    knob: "depth fixed at 3",
    maxLiveN: 6,
    options: { fixedDepth: 3 },
  },
  greedy: {
    id: "greedy",
    label: "Greedy one-ply",
    short: "Greedy",
    description:
      "No opening book: takes an immediate win if there is one, otherwise the move with the best evaluation one ply ahead.",
    knob: "depth fixed at 1, no opening book",
    maxLiveN: 8,
    options: { fixedDepth: 1, enforceGamePlay: false },
  },
  random: {
    id: "random",
    label: "Random baseline",
    short: "Random",
    description:
      "The subject's random agent: steals with probability 1/2 as Blue's first move, otherwise a uniformly random empty cell.",
    knob: "not a minimax agent",
    maxLiveN: 10,
    options: null,
  },
};

export const isAgentId = (x: unknown): x is AgentId =>
  typeof x === "string" && (AGENT_IDS as readonly string[]).includes(x);

/** Ask an agent for its move given the full action history. */
export function tournamentMove(
  id: AgentId,
  n: number,
  history: readonly Action[],
  colour: Colour,
  rng: Rng,
): AgentDecision {
  const agent = AGENTS[id];
  if (agent.options === null) return chooseRandomAction(n, history, rng);
  return chooseAgentAction(n, history, colour, {
    ...agent.options,
    order: rng,
    bias: randomBias(rng),
  });
}
