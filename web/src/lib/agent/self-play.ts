/**
 * Deterministic self-play: the agent (canonical move order, no random bias)
 * playing itself. Used to render a genuine final position on the landing page.
 */
import { Game } from "@/lib/cachex/game";
import type { Action } from "@/lib/cachex/types";
import { chooseAgentAction } from "./player";

export function deterministicSelfPlay(
  n: number,
  maxTurns = 400,
): { actions: Action[]; game: Game } {
  const game = new Game(n);
  const actions: Action[] = [];
  while (!game.over() && actions.length < maxTurns) {
    const { action } = chooseAgentAction(n, actions, game.turnPlayer());
    game.update(game.turnPlayer(), action);
    actions.push(action);
  }
  return { actions, game };
}
