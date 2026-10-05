"use client";

import { useCallback, useEffect, useRef } from "react";

import { type GameRecord, playTournamentGame } from "@/lib/tournament/play";
import type { GameSpec } from "@/lib/tournament/schedule";
import type { TournamentJobResult } from "@/workers/tournament.worker";

/** Number of parallel workers: leave one core for the page, cap at 4. */
export function poolSize(): number {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(4, cores - 1));
}

/**
 * Runs a list of games across a small pool of Web Workers, reporting each
 * record as it finishes. Falls back to the main thread (yielding between
 * games) when workers are unavailable. Cancelling terminates the workers.
 */
export function useTournamentPool() {
  const workers = useRef<Worker[]>([]);
  const cancelled = useRef(false);

  const stop = useCallback(() => {
    cancelled.current = true;
    for (const w of workers.current) w.terminate();
    workers.current = [];
  }, []);

  useEffect(() => stop, [stop]);

  const run = useCallback(
    (specs: GameSpec[], onRecord: (record: GameRecord) => void): Promise<"done" | "cancelled"> => {
      stop();
      cancelled.current = false;
      let next = 0;
      let finished = 0;

      return new Promise((resolve, reject) => {
        const finishIfDone = () => {
          if (finished === specs.length) {
            stop();
            cancelled.current = false;
            resolve("done");
          }
        };
        if (specs.length === 0) return resolve("done");

        let pool: Worker[] = [];
        try {
          pool = Array.from(
            { length: Math.min(poolSize(), specs.length) },
            () =>
              new Worker(new URL("../workers/tournament.worker.ts", import.meta.url), {
                type: "module",
              }),
          );
        } catch {
          pool = [];
        }

        if (pool.length === 0) {
          // Main-thread fallback.
          const step = () => {
            if (cancelled.current) return resolve("cancelled");
            if (next >= specs.length) return resolve("done");
            onRecord(playTournamentGame(specs[next++]));
            setTimeout(step, 0);
          };
          return step();
        }

        workers.current = pool;
        const dispatch = (w: Worker) => {
          if (next >= specs.length) return;
          const id = next++;
          w.postMessage({ id, spec: specs[id] });
        };
        for (const w of pool) {
          w.onmessage = (event: MessageEvent<TournamentJobResult>) => {
            if (cancelled.current) return;
            const res = event.data;
            if (!res.ok) {
              stop();
              reject(new Error(res.error));
              return;
            }
            finished++;
            onRecord(res.record);
            dispatch(w);
            finishIfDone();
          };
          w.onerror = () => {
            stop();
            reject(new Error("A tournament worker crashed."));
          };
          dispatch(w);
        }
        const poll = setInterval(() => {
          if (cancelled.current) {
            clearInterval(poll);
            resolve("cancelled");
          } else if (finished === specs.length) clearInterval(poll);
        }, 200);
      });
    },
    [stop],
  );

  return { run, stop };
}
