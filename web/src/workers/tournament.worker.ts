/**
 * Plays tournament games off the main thread. The pool in
 * use-tournament-pool.ts runs several of these in parallel.
 */
import { type GameRecord, playTournamentGame } from "@/lib/tournament/play";
import type { GameSpec } from "@/lib/tournament/schedule";

export interface TournamentJob {
  id: number;
  spec: GameSpec;
}

export type TournamentJobResult =
  { id: number; ok: true; record: GameRecord } | { id: number; ok: false; error: string };

const ctx = self as unknown as {
  postMessage: (message: TournamentJobResult) => void;
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<TournamentJob>) => void,
  ) => void;
};

ctx.addEventListener("message", ({ data }) => {
  try {
    ctx.postMessage({ id: data.id, ok: true, record: playTournamentGame(data.spec) });
  } catch (err) {
    ctx.postMessage({
      id: data.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
