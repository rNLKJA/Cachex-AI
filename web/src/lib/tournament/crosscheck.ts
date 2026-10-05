/**
 * Compare the TypeScript reference tournament with the original-Python
 * cross-check (scripts/crosscheck_tournament.py) on the pairings and board
 * sizes both ran. RNG streams differ between the two, so games differ; the
 * question is whether the win rates agree within sampling error.
 */
import {
  type DifferenceCI,
  type ProportionCI,
  newcombeDifference,
  wilson,
} from "@/lib/stats/proportion";
import type { AgentId } from "./agents";
import { type GameRecord, winningAgent } from "./play";
import { canonicalAgents } from "./schedule";

export interface PythonGame {
  n: number;
  red: AgentId;
  blue: AgentId;
  seed: number;
  winner: "red" | "blue" | null;
  turns: number;
}

export interface CrosscheckRow {
  a: AgentId;
  b: AgentId;
  sizes: number[];
  python: ProportionCI;
  typescript: ProportionCI;
  /** Python − TypeScript win rate of `a`, Newcombe 95% interval. */
  difference: DifferenceCI;
}

const winnerOf = (g: PythonGame): AgentId | null => (g.winner === null ? null : g[g.winner]);

export function compareImplementations(
  ts: readonly GameRecord[],
  py: readonly PythonGame[],
): CrosscheckRow[] {
  const sizes = [...new Set(py.map((g) => g.n))].sort((x, y) => x - y);
  const agents = canonicalAgents([...new Set(py.flatMap((g) => [g.red, g.blue]))]);
  const rows: CrosscheckRow[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];
      const isPair = (red: AgentId, blue: AgentId) =>
        (red === a && blue === b) || (red === b && blue === a);
      const pyGames = py.filter((g) => sizes.includes(g.n) && isPair(g.red, g.blue));
      const tsGames = ts.filter((g) => sizes.includes(g.n) && isPair(g.red.agent, g.blue.agent));
      if (!pyGames.length || !tsGames.length) continue;
      const pyWins = pyGames.filter((g) => winnerOf(g) === a).length;
      const tsWins = tsGames.filter((g) => winningAgent(g) === a).length;
      rows.push({
        a,
        b,
        sizes,
        python: wilson(pyWins, pyGames.length),
        typescript: wilson(tsWins, tsGames.length),
        difference: newcombeDifference(pyWins, pyGames.length, tsWins, tsGames.length),
      });
    }
  }
  return rows;
}
