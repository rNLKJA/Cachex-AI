/**
 * Runs the paired Manhattan vs Euclidean heuristic study off the main thread.
 */
import { type PairedStudyRow, runPairedStudy } from "@/lib/analysis/astar-paired";

export interface BenchmarkRequest {
  id: number;
  dimensions: number[];
  boardsPerDimension: number;
  seed: number;
}

export type BenchmarkResponse =
  | { id: number; ok: true; rows: PairedStudyRow[]; elapsedMs: number }
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
    const rows = runPairedStudy(data);
    ctx.postMessage({ id: data.id, ok: true, rows, elapsedMs: performance.now() - started });
  } catch (err) {
    ctx.postMessage({
      id: data.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
