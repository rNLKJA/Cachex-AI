/**
 * Round-robin schedule. Every pairing plays `rounds` colour-swapped pairs of
 * games on every board size: in each round the same seed is used twice, once
 * with each agent as Red, so first-move advantage cancels within a pairing.
 */
import { deriveSeed } from "@/lib/rng";
import { AGENT_IDS, type AgentId } from "./agents";

export interface TournamentConfig {
  agents: AgentId[];
  sizes: number[];
  /** Colour-swapped game pairs per pairing per board size (games = 2 × rounds). */
  rounds: number;
  seed: number;
}

export interface GameSpec {
  id: string;
  n: number;
  red: AgentId;
  blue: AgentId;
  /** Shared by both games of a colour-swapped pair. */
  seed: number;
  round: number;
}

/** Agents in canonical order, without duplicates. */
export const canonicalAgents = (agents: readonly AgentId[]) =>
  AGENT_IDS.filter((id) => agents.includes(id));

export function pairKey(a: AgentId, b: AgentId): string {
  const [x, y] = canonicalAgents([a, b]);
  return `${x}|${y}`;
}

export function buildSchedule(config: TournamentConfig): GameSpec[] {
  const agents = canonicalAgents(config.agents);
  if (agents.length < 2) throw new RangeError("a round robin needs at least two agents");
  if (!Number.isInteger(config.rounds) || config.rounds < 1) {
    throw new RangeError("rounds must be a positive integer");
  }
  const sizes = [...new Set(config.sizes)].sort((a, b) => a - b);
  const games: GameSpec[] = [];
  for (const n of sizes) {
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const a = agents[i];
        const b = agents[j];
        for (let round = 0; round < config.rounds; round++) {
          const seed = deriveSeed(
            config.seed,
            n,
            AGENT_IDS.indexOf(a),
            AGENT_IDS.indexOf(b),
            round,
          );
          games.push({ id: `${n}:${a}:${b}:${round}:a`, n, red: a, blue: b, seed, round });
          games.push({ id: `${n}:${a}:${b}:${round}:b`, n, red: b, blue: a, seed, round });
        }
      }
    }
  }
  return games;
}
