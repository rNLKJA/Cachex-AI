import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fromPy, partB, position, toAction } from "@/lib/__fixtures__/load";
import { Game } from "@/lib/cachex/game";
import { STEAL, place } from "@/lib/cachex/types";
import { createRng } from "@/lib/rng";
import { AgentBoard } from "./agent-board";
import { computeFeatures, evaluate, scoreFeatures } from "./evaluation";
import { scoreMatrix } from "./features";
import { createContext, gameEnd, getValidActions, minimax } from "./minimax";
import { agentAction, chooseAgentAction, dynamicDepthAllocation } from "./player";
import { chooseRandomAction } from "./random-player";
import weights from "./weights.json";

const fixtures = partB();

describe("weights", () => {
  it("is a verbatim copy of the original utility/weights.json", () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
    const original = read("../../../../coursework/Project Part B/code/utility/weights.json");
    expect(read("./weights.json")).toBe(original);
    expect(weights).toEqual(JSON.parse(original));
  });
});

describe("score_matrix parity", () => {
  it.each(Object.entries(fixtures.scoreMatrices))("n = %s", (n, expected) => {
    expect(scoreMatrix(Number(n))).toEqual(expected);
  });
});

describe("evaluation feature parity", () => {
  it.each(fixtures.evalPositions.map((p, i) => [i, p] as const))("position %i", (_, p) => {
    const { n, actions } = position(fixtures, p);
    const board = AgentBoard.fromActions(n, actions);
    const f = computeFeatures(board);
    const expected = p.features;
    expect(f.empty).toBe(expected.empty);
    for (const key of ["triangle", "tokens", "location", "diamond", "weakness"] as const) {
      expect(f[key], key).toEqual({
        red: fromPy(expected[key].red),
        blue: fromPy(expected[key].blue),
      });
    }
    expect(scoreFeatures(f)).toBe(fromPy(p.eval));
    expect(evaluate(board)).toBe(fromPy(p.eval));
  });
});

describe("minimax parity (canonical move order, no bias)", () => {
  it.each(fixtures.minimax.map((m, i) => [i, m] as const))("case %i", (_, m) => {
    const { n, actions } = position(fixtures, m);
    const board = AgentBoard.fromActions(n, actions);
    const [score, action] = minimax(
      board,
      m.depth,
      -Infinity,
      Infinity,
      m.maximizing,
      createContext(),
    );
    expect(score).toBe(fromPy(m.score));
    expect(action).toEqual(m.action === null ? null : toAction(m.action));
  });
});

describe("Player.action parity", () => {
  it.each(fixtures.agentMoves.map((m, i) => [i, m] as const))("move %i", (_, m) => {
    const { n, actions } = position(fixtures, m);
    const decision = chooseAgentAction(n, actions, m.colour);
    expect(decision.action).toEqual(toAction(m.action));
  });

  it.each(fixtures.agentGames.map((g) => [g.n, g] as const))(
    "deterministic self-play on n = %i replays move for move",
    (n, g) => {
      const game = new Game(n);
      const expected = g.actions.map(toAction);
      for (const want of expected) {
        const { action } = chooseAgentAction(
          n,
          game.log.map((t) => t.action),
          game.turnPlayer(),
        );
        expect(action).toEqual(want);
        game.update(game.turnPlayer(), action);
      }
      const result = game.result?.kind === "win" ? `winner: ${game.result.winner}` : "draw";
      expect(result).toBe(g.result);
    },
  );
});

describe("agent behaviour", () => {
  it("allocates deeper searches as the board fills up", () => {
    const empty = new AgentBoard(10);
    expect(dynamicDepthAllocation(empty)).toBe(1);
    const nearlyFull = new AgentBoard(10);
    nearlyFull.data.fill(1);
    nearlyFull.data[0] = 0;
    expect(dynamicDepthAllocation(nearlyFull)).toBe(4);
  });

  it("uses the opening book on the first two turns", () => {
    expect(chooseAgentAction(5, [], "red").action).toEqual(place(1, 1));
    expect(chooseAgentAction(5, [place(1, 1)], "blue").action).toEqual(STEAL);
    expect(chooseAgentAction(3, [], "red").explanation.kind).toBe("opening");
  });

  it("takes an immediate win", () => {
    // Red owns (0,0) and (1,0) on a 3x3 board; (2,0) wins.
    const actions = [place(0, 0), place(0, 2), place(1, 0), place(1, 2)];
    const decision = chooseAgentAction(3, actions, "red");
    expect(decision.explanation.kind).toBe("instant-win");
    const board = AgentBoard.fromActions(3, [...actions, decision.action]);
    expect(gameEnd(board)).toBe(true);
  });

  it("explains searched moves with root candidates and a feature breakdown", () => {
    const decision = agentAction(
      AgentBoard.fromActions(5, [place(1, 1), place(3, 3), place(0, 4)]),
      "blue",
      {
        order: createRng(1),
      },
    );
    expect(decision.explanation.kind).toBe("search");
    if (decision.explanation.kind === "search") {
      expect(decision.explanation.candidates.length).toBe(22);
      expect(decision.explanation.features).toHaveLength(6);
    }
  });

  it("offers STEAL only on turn 2 and never the centre on turn 1", () => {
    const b = new AgentBoard(5);
    expect(getValidActions(b, "canonical")).not.toContainEqual(place(2, 2));
    b.update("red", place(0, 0));
    expect(getValidActions(b, "canonical")).toContainEqual(STEAL);
  });
});

describe("random agent", () => {
  it("always returns a legal action", () => {
    const rng = createRng(7);
    for (let trial = 0; trial < 20; trial++) {
      const game = new Game(5);
      while (!game.over()) {
        const { action } = chooseRandomAction(
          5,
          game.log.map((t) => t.action),
          rng,
        );
        expect(game.isLegal(action)).toBe(true);
        game.update(game.turnPlayer(), action);
      }
    }
  });
});

describe("deterministicSelfPlay", () => {
  it("reproduces the original self-play game on 7×7", async () => {
    const { deterministicSelfPlay } = await import("./self-play");
    const expected = fixtures.agentGames.find((g) => g.n === 7)!;
    const { actions, game } = deterministicSelfPlay(7);
    expect(actions).toEqual(expected.actions.map(toAction));
    expect(game.result?.kind === "win" && game.result.winner).toBe("red");
  });
});
