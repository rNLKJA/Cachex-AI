/**
 * Commentary state kept outside the panel, keyed by the exact facts sent to
 * the model. The panel is remounted whenever the shown move changes (for
 * example during spectator autoplay), so a reply that arrives after that is
 * stored here instead of being dropped, and appears, still awaiting review,
 * when the visitor selects that move again.
 */
import type { HumanDecision } from "@/lib/ai/audit-log";
import type { Commentary, GroundingResult } from "@/lib/ai/commentator";

export type CommentaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "done";
      commentary: Commentary;
      grounding: GroundingResult;
      entryId: string;
      model: string;
      decision: HumanDecision;
      edited?: string;
    };

export const IDLE: CommentaryState = { status: "idle" };

const states = new Map<string, CommentaryState>();
const listeners = new Set<() => void>();

export function getCommentaryState(key: string): CommentaryState {
  return states.get(key) ?? IDLE;
}

export function setCommentaryState(key: string, state: CommentaryState): void {
  states.set(key, state);
  for (const l of listeners) l();
}

export function subscribeCommentary(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
