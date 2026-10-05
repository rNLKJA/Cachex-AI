/**
 * Port of the random baseline used to train/test the agent
 * (coursework/Project Part B/skeleton-code-B/random_play_agent/player.py).
 *
 * On its first move as Blue it steals with probability 1/2; otherwise it
 * places on a uniformly random empty cell (never the centre on move 1).
 */
import { Board } from "@/lib/cachex/board";
import { type Action, STEAL, place } from "@/lib/cachex/types";
import { type Rng, choice } from "@/lib/rng";
import type { AgentDecision } from "./player";

export function chooseRandomAction(n: number, history: readonly Action[], rng: Rng): AgentDecision {
  const board = new Board(n);
  history.forEach((action, i) => {
    if (action[0] === "STEAL") board.swap();
    else board.place(i % 2 === 0 ? "red" : "blue", action[1], action[2]);
  });
  const turn = history.length + 1;

  if (turn === 2 && rng() < 0.5) {
    return { action: STEAL, explanation: { kind: "random", options: 2 } };
  }

  const moves: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let q = 0; q < n; q++) {
      if (!board.isOccupied(r, q)) moves.push([r, q]);
    }
  }
  const centre = Math.floor(n / 2);
  const legal = n % 2 === 1 && turn === 1 ? moves.filter(([r, q]) => r !== centre || q !== centre) : moves;
  const [r, q] = choice(rng, legal);
  return { action: place(r, q), explanation: { kind: "random", options: legal.length } };
}
