"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type BenchmarkRow, runHeuristicBenchmark } from "@/lib/astar/random-board";
import type { BenchmarkResponse } from "@/workers/astar-benchmark.worker";

type State =
  | { status: "idle" }
  | { status: "running"; seed: number }
  | { status: "done"; seed: number; rows: BenchmarkRow[]; elapsedMs: number }
  | { status: "error"; message: string };

/** Runs the heuristic study in a Web Worker (main-thread fallback). */
export function useAstarBenchmark() {
  const [state, setState] = useState<State>({ status: "idle" });
  const workerRef = useRef<Worker | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("../workers/astar-benchmark.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<BenchmarkResponse>) => {
        const res = event.data;
        if (res.id !== latest.current) return;
        setState((prev) =>
          res.ok
            ? {
                status: "done",
                seed: prev.status === "running" ? prev.seed : 0,
                rows: res.rows,
                elapsedMs: res.elapsedMs,
              }
            : { status: "error", message: res.error },
        );
      };
      worker.onerror = () =>
        setState({ status: "error", message: "The benchmark worker crashed." });
    } catch {
      worker = null;
    }
    workerRef.current = worker;
    return () => worker?.terminate();
  }, []);

  const run = useCallback((dimensions: number[], seed: number) => {
    const id = ++latest.current;
    setState({ status: "running", seed });
    const worker = workerRef.current;
    if (worker) {
      worker.postMessage({ id, dimensions, seed });
    } else {
      setTimeout(() => {
        const started = performance.now();
        const rows = runHeuristicBenchmark(dimensions, seed);
        if (id === latest.current)
          setState({ status: "done", seed, rows, elapsedMs: performance.now() - started });
      }, 0);
    }
  }, []);

  return { state, run };
}
