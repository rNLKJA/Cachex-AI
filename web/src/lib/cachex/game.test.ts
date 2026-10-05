import { describe, expect, it } from "vitest";

import { partB, toAction } from "@/lib/__fixtures__/load";
import { Board } from "./board";
import { Game, IllegalActionError, MAX_TURNS } from "./game";
import { STEAL, place } from "./types";

const fixtures = partB();

describe("referee parity (seeded random games from the original referee)", () => {
  it.each(fixtures.refereeGames.map((g, i) => [i, g] as const))("game %i", (_, g) => {
    const game = new Game(g.n);
    g.actions.forEach((pyAction, i) => {
      const action = toAction(pyAction);
      game.update(game.turnPlayer(), action);
      const step = g.steps[i];
      expect(game.board.digest(), `turn ${i + 1}`).toBe(step.board);
      const captures = action[0] === "STEAL" ? [] : [...game.lastCaptures].map((c) => [...c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      expect(captures, `captures on turn ${i + 1}`).toEqual(step.captures);
      const result = game.result === null ? null : game.result.kind === "win" ? `winner: ${game.result.winner}` : "draw";
      expect(result).toBe(step.result);
    });
  });

  it("the fixtures exercise captures, steals and wins for both colours", () => {
    const steps = fixtures.refereeGames.flatMap((g) => g.steps);
    expect(steps.filter((s) => s.captures.length > 0).length).toBeGreaterThan(20);
    expect(fixtures.refereeGames.filter((g) => g.actions[1]?.[0] === "STEAL").length).toBeGreaterThan(3);
    const results = new Set(steps.map((s) => s.result).filter(Boolean));
    expect(results).toEqual(new Set(["winner: red", "winner: blue"]));
  });
});

describe("capture rule", () => {
  it("captures both cells of a completed diamond", () => {
    // Blue at (1,1) and (2,0) form the narrow axis of a diamond; red holds (1,0) and plays (2,1).
    const b = new Board(4);
    b.place("blue", 1, 1);
    b.place("blue", 2, 0);
    b.place("red", 1, 0);
    const captured = b.place("red", 2, 1);
    expect(captured.map((c) => [...c]).sort()).toEqual([
      [1, 1],
      [2, 0],
    ]);
    expect(b.get(1, 1)).toBeNull();
    expect(b.get(2, 0)).toBeNull();
    expect(b.get(2, 1)).toBe("red");
  });

  it("does not capture when the diamond is incomplete", () => {
    const b = new Board(4);
    b.place("blue", 1, 1);
    b.place("red", 1, 0);
    expect(b.place("red", 2, 1)).toEqual([]);
  });
});

describe("game rules", () => {
  it("swaps by transposing and recolouring on STEAL", () => {
    const g = new Game(5);
    g.update("red", place(1, 3));
    g.update("blue", STEAL);
    expect(g.board.get(3, 1)).toBe("blue");
    expect(g.board.get(1, 3)).toBeNull();
    expect(g.turnPlayer()).toBe("red");
  });

  it("only allows STEAL on Blue's first move", () => {
    const g = new Game(5);
    expect(() => g.update("red", STEAL)).toThrow(IllegalActionError);
    g.update("red", place(0, 0));
    g.update("blue", place(1, 1));
    expect(() => g.update("red", STEAL)).toThrow(IllegalActionError);
  });

  it("forbids the centre on the first move of odd boards only", () => {
    expect(() => new Game(5).update("red", place(2, 2))).toThrow(/centre/);
    expect(() => new Game(4).update("red", place(2, 2))).not.toThrow();
    const g = new Game(5);
    g.update("red", place(0, 0));
    expect(() => g.update("blue", place(2, 2))).not.toThrow();
  });

  it("rejects occupied cells, out-of-bounds cells and out-of-turn moves", () => {
    const g = new Game(3);
    g.update("red", place(0, 0));
    expect(() => g.update("blue", place(0, 0))).toThrow(/occupied/);
    expect(() => g.update("blue", place(3, 0))).toThrow(/outside/);
    expect(() => g.update("red", place(1, 0))).toThrow(/turn/);
  });

  it("detects a Red win along the r axis", () => {
    const g = Game.fromActions(3, [place(0, 0), place(0, 1), place(1, 0), place(1, 1), place(2, 0)]);
    expect(g.result).toMatchObject({ kind: "win", winner: "red" });
  });

  it("declares a draw after the maximum number of turns", () => {
    expect(MAX_TURNS).toBe(343);
  });
});
