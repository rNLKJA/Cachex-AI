import { describe, expect, it } from "vitest";

import { deriveMatchView, evaluationTrend, undoToHumanTurn } from "./match";
import { STEAL, place } from "./types";

describe("deriveMatchView", () => {
  it("reports the last move and the colour of captured tokens", () => {
    const view = deriveMatchView(4, [
      place(1, 1),
      place(0, 0),
      place(1, 0),
      place(3, 3),
      place(2, 0),
      place(2, 2),
    ]);
    expect(view.lastMove).toEqual([2, 2]);
    expect(view.cells.filter(Boolean)).toHaveLength(6);

    const capture = deriveMatchView(4, [
      place(1, 1),
      place(1, 0),
      place(2, 0),
      place(3, 3),
      place(0, 3),
      place(2, 1),
    ]);
    // Blue's (2,1) with Blue at (1,0) completes a diamond around Red's (1,1) and (2,0)
    expect(capture.captured.map((c) => c.colour)).toEqual(["red", "red"]);
    expect(capture.cells[1 * 4 + 1]).toBeNull();
  });

  it("has no last move after a steal", () => {
    expect(deriveMatchView(5, [place(1, 1), STEAL]).lastMove).toBeNull();
  });

  it("exposes the winning chain", () => {
    const view = deriveMatchView(3, [
      place(0, 0),
      place(0, 1),
      place(1, 0),
      place(1, 1),
      place(2, 0),
    ]);
    expect(view.winning).toHaveLength(3);
  });
});

describe("undoToHumanTurn", () => {
  const kinds = { red: "human", blue: "minimax" } as const;

  it("removes the AI reply and the human move", () => {
    const actions = [place(0, 0), place(1, 1), place(2, 2), place(3, 3)];
    expect(undoToHumanTurn(actions, kinds)).toEqual([place(0, 0), place(1, 1)]);
  });

  it("removes only the human move while the AI is thinking", () => {
    expect(undoToHumanTurn([place(0, 0), place(1, 1), place(2, 2)], kinds)).toEqual([
      place(0, 0),
      place(1, 1),
    ]);
  });
});

describe("evaluationTrend", () => {
  it("starts from the empty-board score and adds one value per move", () => {
    const trend = evaluationTrend(3, [place(0, 0), place(2, 2)]);
    expect(trend).toHaveLength(3);
    expect(trend[0]).toBe(9 * 0.5);
  });
});
