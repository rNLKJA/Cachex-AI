/**
 * Runs the Manhattan vs Euclidean heuristic study off the main thread.
 */
import { type BenchmarkRow, runHeuristicBenchmark } from "@/lib/astar/random-board";

export interface BenchmarkRequest {
  id: number;
  dimensions: number[];
  seed: number;
}

export type BenchmarkResponse =
  | { id: number; ok: true; rows: BenchmarkRow[]; elapsedMs: number }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as {
  postMessage: (message: BenchmarkResponse) => void;
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<BenchmarkRequest>) => void,
  ) => void;
};

ctx.addEventListener("message", ({ data }) => {
  const started = performance.now();
  try {
    const rows = runHeuristicBenchmark(data.dimensions, data.seed);
    ctx.postMessage({ id: data.id, ok: true, rows, elapsedMs: performance.now() - started });
  } catch (err) {
    ctx.postMessage({
      id: data.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
