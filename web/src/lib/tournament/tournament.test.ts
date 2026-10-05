import { describe, expect, it } from "vitest";

import { AgentBoard } from "@/lib/agent/agent-board";
import { chooseAgentAction } from "@/lib/agent/player";
import { runAgent } from "@/lib/agent/run-agent";
import { place } from "@/lib/cachex/types";
import { csvCell, toCsv } from "@/lib/csv";
import { AGENT_IDS, AGENTS, tournamentMove } from "./agents";
import { eloDifference, gamesCsv, summariseTournament, summaryCsv } from "./analyse";
import { type GameRecord, playTournamentGame } from "./play";
import { buildSchedule, pairKey } from "./schedule";
import { createRng } from "@/lib/rng";

describe("round-robin schedule", () => {
  const config = {
    agents: ["random", "greedy", "minimax-dynamic"] as const,
    sizes: [5, 4, 4],
    rounds: 3,
    seed: 11,
  };
  const games = buildSchedule({ ...config, agents: [...config.agents] });

  it("plays every pairing on every size, colour-swapped", () => {
    // 3 pairings × 2 sizes × 3 rounds × 2 colours
    expect(games).toHaveLength(36);
    const byPair = new Map<string, typeof games>();
    for (const g of games) {
      const key = `${g.n}|${pairKey(g.red, g.blue)}`;
      byPair.set(key, [...(byPair.get(key) ?? []), g]);
    }
    expect(byPair.size).toBe(6);
    for (const list of byPair.values()) {
      expect(list).toHaveLength(6);
      const [a, b] = pairKey(list[0].red, list[0].blue).split("|");
      expect(list.filter((g) => g.red === a)).toHaveLength(3);
      expect(list.filter((g) => g.red === b)).toHaveLength(3);
    }
  });

  it("shares one seed between the two games of a colour-swapped pair", () => {
    for (let i = 0; i < games.length; i += 2) {
      expect(games[i].seed).toBe(games[i + 1].seed);
      expect(games[i].red).toBe(games[i + 1].blue);
    }
    expect(new Set(games.map((g) => g.seed)).size).toBe(games.length / 2);
    expect(new Set(games.map((g) => g.id)).size).toBe(games.length);
  });

  it("is deterministic and rejects degenerate configs", () => {
    expect(buildSchedule({ ...config, agents: [...config.agents] })).toEqual(games);
    expect(() => buildSchedule({ ...config, agents: ["random"] })).toThrow(RangeError);
    expect(() => buildSchedule({ ...config, agents: [...config.agents], rounds: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("agents", () => {
  it("are the original with one knob changed", () => {
    const n = 6;
    const history = [place(1, 1), place(4, 2), place(2, 3)] as const;
    // The original, unpatched, is exactly what /play and /spectate run.
    const original = tournamentMove("minimax-dynamic", n, history, "blue", createRng(3));
    const viaPlayPage = runAgent({
      id: 1,
      kind: "minimax",
      n,
      history: [...history],
      colour: "blue",
      seed: 3,
    });
    if (!viaPlayPage.ok) throw new Error(viaPlayPage.error);
    expect(original).toEqual(viaPlayPage.decision);
    if (original.explanation.kind !== "search") throw new Error("expected a search");
    expect(original.explanation.depth).toBe(1);

    const d3 = tournamentMove("minimax-d3", n, history, "blue", createRng(3));
    if (d3.explanation.kind !== "search") throw new Error("expected a search");
    expect(d3.explanation.depth).toBe(3);

    // Greedy skips the opening book.
    const greedyOpening = tournamentMove("greedy", n, [], "red", createRng(1));
    expect(greedyOpening.explanation.kind).toBe("search");
    const bookOpening = tournamentMove("minimax-d2", n, [], "red", createRng(1));
    expect(bookOpening.explanation.kind).toBe("opening");
    expect(tournamentMove("random", n, [], "red", createRng(1)).explanation.kind).toBe("random");
    expect(AGENT_IDS.every((id) => AGENTS[id].id === id)).toBe(true);
  });

  it("fixed depth 1 never looks past one ply", () => {
    const board = AgentBoard.fromActions(5, [place(1, 1), place(3, 3), place(2, 2)]);
    const d = chooseAgentAction(5, [place(1, 1), place(3, 3), place(2, 2)], "blue", {
      fixedDepth: 1,
    });
    if (d.explanation.kind !== "search") throw new Error("expected a search");
    expect(d.explanation.depth).toBe(1);
    // depth 1 visits the root plus one node per legal move
    expect(d.explanation.nodes).toBe(1 + board.emptyCount());
  });
});

describe("playing a game", () => {
  const spec = {
    id: "t",
    n: 4,
    red: "minimax-dynamic",
    blue: "random",
    seed: 99,
    round: 0,
  } as const;

  it("is reproducible from its seed", () => {
    let t = 0;
    const now = () => (t += 1);
    const a = playTournamentGame({ ...spec }, { now });
    t = 0;
    const b = playTournamentGame({ ...spec }, { now });
    expect(a).toEqual(b);
    expect(a.result === "win" || a.result === "draw").toBe(true);
    expect(a.red.moves + a.blue.moves).toBe(a.turns);
    expect(a.red.illegal + a.blue.illegal).toBe(0);
  });

  it("forfeits the game on an illegal move or an exception", () => {
    const illegal = playTournamentGame(
      { ...spec },
      {
        move: (id, n, history, colour) =>
          colour === "blue"
            ? place(9, 9)
            : tournamentMove(id, n, history, colour, createRng(1)).action,
      },
    );
    expect(illegal).toMatchObject({ result: "forfeit", winner: "red", turns: 1 });
    expect(illegal.blue.illegal).toBe(1);

    const crash = playTournamentGame(
      { ...spec },
      {
        move: () => {
          throw new Error("boom");
        },
      },
    );
    expect(crash).toMatchObject({ result: "forfeit", winner: "blue", turns: 0 });
    expect(crash.red.illegal).toBe(1);
  });
});

function record(
  red: GameRecord["red"]["agent"],
  blue: GameRecord["blue"]["agent"],
  winner: "red" | "blue" | null,
  n = 4,
  i = 0,
): GameRecord {
  const side = (agent: GameRecord["red"]["agent"]) => ({
    agent,
    moves: 5,
    totalMs: 10,
    maxMs: 3,
    nodes: 20,
    searches: 4,
    deepSearches: 1,
    illegal: 0,
  });
  return {
    id: `${red}-${blue}-${i}`,
    n,
    seed: i,
    round: i,
    result: winner === null ? "draw" : "win",
    winner,
    drawReason: winner === null ? "repetition" : null,
    turns: 10,
    red: side(red),
    blue: side(blue),
  };
}

describe("tournament summary", () => {
  // Original beats random 9-1, greedy beats random 7-3, original vs greedy 6-4.
  const games: GameRecord[] = [];
  const add = (
    a: GameRecord["red"]["agent"],
    b: GameRecord["red"]["agent"],
    aWins: number,
    bWins: number,
  ) => {
    for (let k = 0; k < aWins; k++)
      games.push(record(k % 2 ? a : b, k % 2 ? b : a, k % 2 ? "red" : "blue", 4, games.length));
    for (let k = 0; k < bWins; k++)
      games.push(record(k % 2 ? a : b, k % 2 ? b : a, k % 2 ? "blue" : "red", 4, games.length));
  };
  add("minimax-dynamic", "random", 9, 1);
  add("greedy", "random", 7, 3);
  add("minimax-dynamic", "greedy", 6, 4);
  games.push(record("greedy", "random", null, 5, games.length));
  const summary = summariseTournament(games, { reps: 200, seed: 1 });

  it("counts wins, losses and draws per agent with Wilson intervals", () => {
    const original = summary.standings.find((s) => s.id === "minimax-dynamic")!;
    expect(original).toMatchObject({ games: 20, wins: 15, losses: 5, draws: 0 });
    expect(original.winRate.p).toBe(0.75);
    const greedy = summary.standings.find((s) => s.id === "greedy")!;
    expect(greedy).toMatchObject({ games: 21, wins: 11, losses: 9, draws: 1 });
    expect(summary.games).toBe(31);
    expect(summary.sizes).toEqual([4, 5]);
  });

  it("anchors Elo at the random agent and orders the leaderboard by strength", () => {
    expect(summary.anchor).toBe("random");
    expect(summary.standings.map((s) => s.id)).toEqual(["minimax-dynamic", "greedy", "random"]);
    const random = summary.standings.find((s) => s.id === "random")!;
    expect(random.elo.estimate).toBe(0);
    for (const s of summary.standings) {
      expect(s.elo.lower).toBeLessThanOrEqual(s.elo.estimate + 1e-9);
      expect(s.elo.upper).toBeGreaterThanOrEqual(s.elo.estimate - 1e-9);
    }
  });

  it("compares agents by Elo differences from the same bootstrap refits", () => {
    expect(summary.eloDifferences).toHaveLength(3); // every pair once
    const elo = (id: string) => summary.standings.find((s) => s.id === id)!.elo.estimate;
    const d = eloDifference(summary, "minimax-dynamic", "greedy")!;
    expect(d.estimate).toBeCloseTo(elo("minimax-dynamic") - elo("greedy"), 9);
    expect(d.lower).toBeLessThanOrEqual(d.estimate + 1e-9);
    expect(d.upper).toBeGreaterThanOrEqual(d.estimate - 1e-9);
    const flipped = eloDifference(summary, "greedy", "minimax-dynamic")!;
    expect(flipped).toMatchObject({ a: "greedy", b: "minimax-dynamic" });
    expect(flipped.estimate).toBeCloseTo(-d.estimate, 12);
    expect(flipped.lower).toBeCloseTo(-d.upper, 12);
    // Against the anchor, the difference is just the anchored Elo and its interval.
    const vsRandom = eloDifference(summary, "greedy", "random")!;
    const greedy = summary.standings.find((s) => s.id === "greedy")!.elo;
    expect(vsRandom.lower).toBeCloseTo(greedy.lower, 9);
    expect(vsRandom.upper).toBeCloseTo(greedy.upper, 9);
    expect(summaryCsv(summary)).toContain("elo_difference,minimax-dynamic,greedy");
  });

  it("reports pairings and the colour effect", () => {
    const p = summary.pairs.find((x) => x.a === "minimax-dynamic" && x.b === "random")!;
    expect(p).toMatchObject({ games: 10, aWins: 9, bWins: 1, draws: 0 });
    expect(p.aAsRed.games + p.aAsBlue.games).toBe(10);
    expect(summary.colour.redWins + summary.colour.blueWins + summary.colour.draws).toBe(31);
  });

  it("filters by board size and is reproducible", () => {
    const only5 = summariseTournament(games, { reps: 50, seed: 1, sizes: [5] });
    expect(only5.games).toBe(1);
    expect(summariseTournament(games, { reps: 200, seed: 1 })).toEqual(summary);
  });

  it("exports CSV", () => {
    const csv = gamesCsv(games);
    expect(csv.split("\r\n")[0]).toContain("game_id,board_n,seed");
    expect(csv.trim().split("\r\n")).toHaveLength(games.length + 1);
    const s = summaryCsv(summary);
    expect(s).toContain("standing,minimax-dynamic");
    expect(s).toContain("pairing,minimax-dynamic,random,10,9,1,0,0.9");
  });
});

describe("CSV writer", () => {
  it("quotes, escapes and neutralises formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(null)).toBe("");
    expect(csvCell(NaN)).toBe("");
    expect(toCsv([{ a: 1, b: "x\ny" }])).toBe('a,b\r\n1,"x\ny"\r\n');
    expect(toCsv([])).toBe("\r\n");
  });
});

describe("Python cross-check comparison", () => {
  it("compares win rates per pairing on the shared sizes", async () => {
    const { compareImplementations } = await import("./crosscheck");
    const ts: GameRecord[] = [
      record("minimax-dynamic", "random", "red", 4, 1),
      record("random", "minimax-dynamic", "blue", 4, 2),
      record("minimax-dynamic", "random", "blue", 6, 3), // size not in the Python run
    ];
    const py = [
      {
        n: 4,
        red: "minimax-dynamic" as const,
        blue: "random" as const,
        seed: 1,
        winner: "red" as const,
        turns: 9,
      },
      {
        n: 4,
        red: "random" as const,
        blue: "minimax-dynamic" as const,
        seed: 1,
        winner: "red" as const,
        turns: 9,
      },
    ];
    const [row] = compareImplementations(ts, py);
    expect(row).toMatchObject({ a: "minimax-dynamic", b: "random", sizes: [4] });
    expect(row.python.p).toBe(0.5);
    expect(row.typescript.p).toBe(1);
    expect(row.difference.estimate).toBe(-0.5);
  });
});
