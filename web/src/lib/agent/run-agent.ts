/**
 * A single entry point used by the Web Worker (and the main-thread fallback)
 * to ask either agent for a move.
 */
import type { Action, Colour } from "@/lib/cachex/types";
import { createRng } from "@/lib/rng";
import { randomBias } from "./evaluation";
import { type AgentDecision, chooseAgentAction } from "./player";
import { chooseRandomAction } from "./random-player";

export type AgentKind = "minimax" | "random";

export interface AgentRequest {
  id: number;
  kind: AgentKind;
  n: number;
  history: Action[];
  colour: Colour;
  /** Seeds the move shuffle and evaluation bias (the original used `random`). */
  seed: number;
}

export type AgentResponse =
  | { id: number; ok: true; decision: AgentDecision; elapsedMs: number }
  | { id: number; ok: false; error: string };

export function runAgent(req: AgentRequest): AgentResponse {
  const started = performance.now();
  try {
    const rng = createRng(req.seed);
    const decision =
      req.kind === "random"
        ? chooseRandomAction(req.n, req.history, rng)
        : chooseAgentAction(req.n, req.history, req.colour, { order: rng, bias: randomBias(rng) });
    return { id: req.id, ok: true, decision, elapsedMs: performance.now() - started };
  } catch (err) {
    return { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
