"use client";

import { Check, Loader2, MessageSquareText, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MoveExplanation } from "@/lib/agent/player";
import { DECISION_LABEL, type HumanDecision } from "@/lib/ai/audit-log";
import { callStructured } from "@/lib/ai/client";
import {
  buildCommentaryFacts,
  commentaryRequest,
  commentaryToText,
  groundingCheck,
} from "@/lib/ai/commentator";
import { isAiError } from "@/lib/ai/types";
import type { Action, Colour } from "@/lib/cachex/types";
import { AiBadge } from "./ai-badge";
import { useAi } from "./ai-provider";
import {
  IDLE,
  getCommentaryState,
  setCommentaryState,
  subscribeCommentary,
} from "./commentary-store";
import { GroundingDetails } from "./grounding-details";

const FEATURE_LABEL: Record<string, string> = {
  empty: "Empty hexes",
  triangle: "Triangle formations",
  tokens: "Token count",
  location: "Positional value",
  diamond: "Capturable diamonds",
  weakness: "Weak formations",
};

/**
 * "Explain in plain English": a bring-your-own-key commentary grounded in the
 * agent's own evaluation breakdown. State lives in the commentary store, keyed
 * by the facts, so a reply that arrives after the panel has moved on is kept.
 */
export function CommentatorPanel({
  n,
  turn,
  colour,
  action,
  explanation,
  onExplainStart,
}: {
  n: number;
  turn: number;
  colour: Colour;
  action: Action;
  explanation: Extract<MoveExplanation, { kind: "search" }>;
  /** Called when the visitor asks for commentary (e.g. to pause autoplay). */
  onExplainStart?: () => void;
}) {
  const { credentials, ready, openSettings, audit } = useAi();
  const facts = useMemo(
    () => buildCommentaryFacts({ n, turn, colour, action, explanation }),
    [n, turn, colour, action, explanation],
  );
  const key = useMemo(() => JSON.stringify(facts), [facts]);
  const state = useSyncExternalStore(
    subscribeCommentary,
    () => getCommentaryState(key),
    () => IDLE,
  );
  const setState = (next: Parameters<typeof setCommentaryState>[1]) =>
    setCommentaryState(key, next);
  const [editing, setEditing] = useState<string | null>(null);

  const run = async () => {
    if (!credentials) return openSettings();
    onExplainStart?.();
    setState({ status: "loading" });
    try {
      // The check is stored with the call, so the log shows it next to the decision.
      const res = await callStructured(credentials, commentaryRequest(facts), {
        audit,
        check: (data) => groundingCheck(data, facts),
        context: { boardSize: n, turn, mover: colour },
      });
      setState({
        status: "done",
        commentary: res.data,
        grounding: res.entry.grounding ?? groundingCheck(res.data, facts),
        entryId: res.entry.id,
        model: res.model,
        decision: "pending",
      });
    } catch (err) {
      setState({ status: "error", message: isAiError(err) ? err.message : String(err) });
    }
  };

  const decide = async (decision: HumanDecision, edited?: string) => {
    if (state.status !== "done") return;
    await audit.update(state.entryId, {
      humanDecision: decision,
      decidedAt: new Date().toISOString(),
      ...(edited !== undefined ? { editedOutput: edited } : {}),
    });
    setState({ ...state, decision, edited });
    setEditing(null);
  };

  return (
    <div className="bg-background/40 rounded-xl border border-dashed p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
          <MessageSquareText className="size-3.5" /> Plain-English commentary
        </h3>
        {state.status !== "done" && (
          <Button
            size="sm"
            variant="outline"
            onClick={run}
            disabled={state.status === "loading" || !ready}
          >
            {state.status === "loading" ? <Loader2 className="animate-spin" /> : null}
            {credentials ? "Explain with AI" : "Add a key to explain"}
          </Button>
        )}
      </div>

      {state.status === "idle" && (
        <p className="text-muted-foreground mt-2 text-xs">
          Optional, with your own API key. The model sees only the numbers above (search depth,
          candidate scores and feature breakdown) and is told not to add anything else.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-destructive mt-2 text-xs">
          {state.message}
        </p>
      )}

      {state.status === "done" && (
        <div className="mt-2 space-y-3">
          <AiBadge model={state.model} />
          {state.decision === "rejected" ? (
            <p className="text-muted-foreground text-sm italic">You rejected this commentary.</p>
          ) : editing !== null ? (
            <div className="space-y-2">
              <Textarea
                aria-label="Edit the commentary"
                value={editing}
                onChange={(e) => setEditing(e.target.value)}
                rows={5}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide("edited", editing)}>
                  Save edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : state.edited !== undefined ? (
            <p className="text-sm whitespace-pre-line">{state.edited}</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>{state.commentary.summary}</p>
              {state.commentary.key_factors.length > 0 && (
                <ul className="space-y-1">
                  {state.commentary.key_factors.map((k, i) => (
                    <li key={i} className="text-muted-foreground text-xs">
                      <span className="text-foreground font-medium">
                        {FEATURE_LABEL[k.feature] ?? k.feature}
                      </span>{" "}
                      ({k.effect.replace("_", " ")}): {k.evidence}
                    </li>
                  ))}
                </ul>
              )}
              {state.commentary.caveat && (
                <p className="text-muted-foreground text-xs">Caveat: {state.commentary.caveat}</p>
              )}
            </div>
          )}

          <GroundingDetails grounding={state.grounding} />

          {state.decision === "pending" && editing === null ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">Your review:</span>
              <Button size="xs" variant="outline" onClick={() => decide("accepted")}>
                <Check /> Accept
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setEditing(commentaryToText(state.commentary))}
              >
                <Pencil /> Edit
              </Button>
              <Button size="xs" variant="outline" onClick={() => decide("rejected")}>
                <X /> Reject
              </Button>
            </div>
          ) : (
            state.decision !== "pending" && (
              <p className="text-muted-foreground text-xs">
                Recorded in the{" "}
                <Link href="/ai-log" className="underline underline-offset-4">
                  AI audit log
                </Link>
                : {DECISION_LABEL[state.decision].toLowerCase()}.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
