/**
 * Turns game records into the numbers the tournament page reports:
 * win rates with Wilson intervals, Bradley-Terry strengths on the Elo scale
 * with stratified bootstrap intervals, the first-move (colour) effect and
 * mean move times with bootstrap intervals.
 *
 * Two agents' strengths are compared through their Elo difference, with an
 * interval taken from the same bootstrap replicates: the two estimates come
 * from one fit and are correlated, so whether their separate intervals
 * overlap is not the right test.
 */
import { type CsvValue, toCsv } from "@/lib/csv";
import { type BootstrapCI, bootstrapMean, stratifiedBootstrapVector } from "@/lib/stats/bootstrap";
import { type PairOutcome, fitBradleyTerry, toElo } from "@/lib/stats/bradley-terry";
import { type ProportionCI, wilson } from "@/lib/stats/proportion";
import { AGENTS, type AgentId } from "./agents";
import { type GameRecord, winningAgent } from "./play";
import { canonicalAgents, pairKey } from "./schedule";

export interface Interval {
  estimate: number;
  lower: number;
  upper: number;
}

export interface AgentStanding {
  id: AgentId;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** Games this agent lost by an illegal move. */
  forfeits: number;
  illegalMoves: number;
  moves: number;
  winRate: ProportionCI;
  /** Bradley-Terry strength on the Elo scale (anchored, see summary.anchor). */
  elo: Interval;
  /** Mean time per move (ms), averaged per game, with a bootstrap CI over games. */
  moveMs: BootstrapCI;
  /** Mean search nodes per move. */
  nodesPerMove: number;
  /** Share of searched moves that looked deeper than one ply. */
  deepSearchShare: number;
}

export interface PairStanding {
  a: AgentId;
  b: AgentId;
  games: number;
  aWins: number;
  bWins: number;
  draws: number;
  /** Win rate of `a` against `b` (draws count as not-wins). */
  aWinRate: ProportionCI;
  /** Wins for `a` when `a` played Red, and games as Red. */
  aAsRed: { games: number; wins: number };
  aAsBlue: { games: number; wins: number };
}

export interface EloDifference extends Interval {
  /** Strength of `a` minus strength of `b`, Elo points (independent of the anchor). */
  a: AgentId;
  b: AgentId;
}

export interface TournamentSummary {
  games: number;
  sizes: number[];
  agents: AgentId[];
  standings: AgentStanding[];
  /** Every pair of agents, in canonical order (a listed before b). */
  eloDifferences: EloDifference[];
  pairs: PairStanding[];
  colour: {
    games: number;
    redWins: number;
    blueWins: number;
    draws: number;
    redWinRate: ProportionCI;
  };
  meanTurns: number;
  /** Agent whose Elo is fixed at 0 (random when present). */
  anchor: AgentId | null;
  bootstrap: { reps: number; seed: number; prior: number };
}

export interface SummariseOptions {
  reps?: number;
  seed?: number;
  /** Virtual drawn games per pairing in the Bradley-Terry fit. */
  prior?: number;
  sizes?: number[];
}

/** Points to each side of one game: 1 / 0, or 0.5 each for a draw. */
function points(g: GameRecord): { red: number; blue: number } {
  if (g.winner === null) return { red: 0.5, blue: 0.5 };
  return g.winner === "red" ? { red: 1, blue: 0 } : { red: 0, blue: 1 };
}

function outcomesFor(records: readonly GameRecord[], index: Map<AgentId, number>): PairOutcome[] {
  return records.map((g) => {
    const p = points(g);
    return {
      i: index.get(g.red.agent)!,
      j: index.get(g.blue.agent)!,
      scoreI: p.red,
      scoreJ: p.blue,
    };
  });
}

export function summariseTournament(
  allRecords: readonly GameRecord[],
  { reps = 1000, seed = 4399, prior = 1, sizes }: SummariseOptions = {},
): TournamentSummary {
  const records = sizes ? allRecords.filter((g) => sizes.includes(g.n)) : [...allRecords];
  const agents = canonicalAgents([...new Set(records.flatMap((g) => [g.red.agent, g.blue.agent]))]);
  const index = new Map(agents.map((id, i) => [id, i]));
  const anchor: AgentId | null = agents.includes("random") ? "random" : null;
  const anchorIndex = anchor === null ? undefined : index.get(anchor);

  // Bradley-Terry with a bootstrap stratified by pairing and board size.
  const strataMap = new Map<string, GameRecord[]>();
  for (const g of records) {
    const key = `${g.n}|${pairKey(g.red.agent, g.blue.agent)}`;
    const list = strataMap.get(key) ?? [];
    list.push(g);
    strataMap.set(key, list);
  }
  const strata = [...strataMap.values()];
  const pairIndex: [number, number][] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) pairIndex.push([i, j]);
  }
  // One vector per replicate: every agent's Elo, then every pairwise difference.
  const eloOf = (s: readonly (readonly GameRecord[])[]) => {
    const elo = toElo(
      fitBradleyTerry(agents.length, outcomesFor(s.flat(), index), { prior }).theta,
      anchorIndex,
    );
    return [...elo, ...pairIndex.map(([i, j]) => elo[i] - elo[j])];
  };
  const bt =
    agents.length >= 2 && records.length > 0
      ? stratifiedBootstrapVector(strata, eloOf, { reps, seed })
      : null;
  const eloDifferences: EloDifference[] = pairIndex.map(([i, j], c) => {
    const k = agents.length + c;
    return {
      a: agents[i],
      b: agents[j],
      estimate: bt ? bt.estimate[k] : NaN,
      lower: bt ? bt.lower[k] : NaN,
      upper: bt ? bt.upper[k] : NaN,
    };
  });

  const standings: AgentStanding[] = agents.map((id, k) => {
    const mine = records.filter((g) => g.red.agent === id || g.blue.agent === id);
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let forfeits = 0;
    let illegalMoves = 0;
    let moves = 0;
    let nodes = 0;
    let searches = 0;
    let deep = 0;
    const perGameMs: number[] = [];
    for (const g of mine) {
      // Self-play is never scheduled, so each game has exactly one side for `id`.
      const side = g.red.agent === id ? "red" : "blue";
      const s = g[side];
      const w = winningAgent(g);
      if (w === null) draws++;
      else if (g.winner === side) wins++;
      else {
        losses++;
        if (g.result === "forfeit") forfeits++;
      }
      illegalMoves += s.illegal;
      moves += s.moves;
      nodes += s.nodes;
      searches += s.searches ?? 0;
      deep += s.deepSearches ?? 0;
      if (s.moves > 0) perGameMs.push(s.totalMs / s.moves);
    }
    return {
      id,
      games: mine.length,
      wins,
      losses,
      draws,
      forfeits,
      illegalMoves,
      moves,
      winRate: wilson(wins, mine.length),
      elo: bt
        ? { estimate: bt.estimate[k], lower: bt.lower[k], upper: bt.upper[k] }
        : { estimate: NaN, lower: NaN, upper: NaN },
      moveMs: bootstrapMean(perGameMs, { reps: Math.min(reps, 1000), seed: seed + 1 + k }),
      nodesPerMove: moves > 0 ? nodes / moves : 0,
      deepSearchShare: searches > 0 ? deep / searches : 0,
    };
  });
  standings.sort((x, y) => y.elo.estimate - x.elo.estimate);

  const pairs: PairStanding[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];
      const games = records.filter(
        (g) =>
          (g.red.agent === a && g.blue.agent === b) || (g.red.agent === b && g.blue.agent === a),
      );
      if (games.length === 0) continue;
      const aWins = games.filter((g) => winningAgent(g) === a).length;
      const bWins = games.filter((g) => winningAgent(g) === b).length;
      const asRed = games.filter((g) => g.red.agent === a);
      const asBlue = games.filter((g) => g.blue.agent === a);
      pairs.push({
        a,
        b,
        games: games.length,
        aWins,
        bWins,
        draws: games.length - aWins - bWins,
        aWinRate: wilson(aWins, games.length),
        aAsRed: { games: asRed.length, wins: asRed.filter((g) => g.winner === "red").length },
        aAsBlue: { games: asBlue.length, wins: asBlue.filter((g) => g.winner === "blue").length },
      });
    }
  }

  const redWins = records.filter((g) => g.winner === "red").length;
  const blueWins = records.filter((g) => g.winner === "blue").length;
  return {
    games: records.length,
    sizes: [...new Set(records.map((g) => g.n))].sort((a, b) => a - b),
    agents,
    standings,
    eloDifferences,
    pairs,
    colour: {
      games: records.length,
      redWins,
      blueWins,
      draws: records.length - redWins - blueWins,
      redWinRate: wilson(redWins, records.length),
    },
    meanTurns: records.length ? records.reduce((s, g) => s + g.turns, 0) / records.length : 0,
    anchor,
    bootstrap: { reps, seed, prior },
  };
}

/** Elo of `a` minus Elo of `b`, with its bootstrap interval, in either order. */
export function eloDifference(
  summary: TournamentSummary,
  a: AgentId,
  b: AgentId,
): EloDifference | null {
  const d = summary.eloDifferences.find(
    (x) => (x.a === a && x.b === b) || (x.a === b && x.b === a),
  );
  if (!d) return null;
  return d.a === a ? d : { a, b, estimate: -d.estimate, lower: -d.upper, upper: -d.lower };
}

/** One row per game, for CSV export. */
export function gamesCsv(records: readonly GameRecord[]): string {
  const rows = records.map((g) => ({
    game_id: g.id,
    board_n: g.n,
    seed: g.seed,
    round: g.round,
    red_agent: g.red.agent,
    blue_agent: g.blue.agent,
    result: g.result,
    winner_colour: g.winner ?? "",
    winner_agent: winningAgent(g) ?? "",
    draw_reason: g.drawReason ?? "",
    turns: g.turns,
    red_moves: g.red.moves,
    red_total_ms: Number(g.red.totalMs.toFixed(3)),
    red_nodes: g.red.nodes,
    red_illegal: g.red.illegal,
    blue_moves: g.blue.moves,
    blue_total_ms: Number(g.blue.totalMs.toFixed(3)),
    blue_nodes: g.blue.nodes,
    blue_illegal: g.blue.illegal,
  }));
  return toCsv(rows);
}

/** Leaderboard and pairwise rows, for CSV export. */
export function summaryCsv(summary: TournamentSummary): string {
  const r = (x: number, d = 4) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
  const rows: Record<string, CsvValue>[] = [];
  for (const s of summary.standings) {
    rows.push({
      table: "standing",
      agent: s.id,
      opponent: "",
      games: s.games,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      win_rate: r(s.winRate.p),
      win_rate_lo95: r(s.winRate.lower),
      win_rate_hi95: r(s.winRate.upper),
      elo: r(s.elo.estimate, 1),
      elo_lo95: r(s.elo.lower, 1),
      elo_hi95: r(s.elo.upper, 1),
      illegal_moves: s.illegalMoves,
      mean_move_ms: r(s.moveMs.estimate, 3),
    });
  }
  for (const p of summary.pairs) {
    rows.push({
      table: "pairing",
      agent: p.a,
      opponent: p.b,
      games: p.games,
      wins: p.aWins,
      losses: p.bWins,
      draws: p.draws,
      win_rate: r(p.aWinRate.p),
      win_rate_lo95: r(p.aWinRate.lower),
      win_rate_hi95: r(p.aWinRate.upper),
      elo: null,
      elo_lo95: null,
      elo_hi95: null,
      illegal_moves: null,
      mean_move_ms: null,
    });
  }
  for (const d of summary.eloDifferences) {
    rows.push({
      table: "elo_difference",
      agent: d.a,
      opponent: d.b,
      games: null,
      wins: null,
      losses: null,
      draws: null,
      win_rate: null,
      win_rate_lo95: null,
      win_rate_hi95: null,
      elo: r(d.estimate, 1),
      elo_lo95: r(d.lower, 1),
      elo_hi95: r(d.upper, 1),
      illegal_moves: null,
      mean_move_ms: null,
    });
  }
  return toCsv(rows);
}

export const agentLabel = (id: AgentId) => AGENTS[id].label;
