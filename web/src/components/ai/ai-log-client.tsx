"use client";

import { Check, Download, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Segmented } from "@/components/play/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type AuditEntry,
  type AuditGrounding,
  type AuditStore,
  DECISION_LABEL,
  type HumanDecision,
  auditToCsv,
  auditToJson,
  onAuditChange,
} from "@/lib/ai/audit-log";
import { CommentarySchema, commentaryToText, recheckLoggedCommentary } from "@/lib/ai/commentator";
import { FEATURE_LABEL, PROVIDER_LABEL } from "@/lib/ai/types";
import { downloadText } from "@/lib/download";
import { cn } from "@/lib/utils";
import { AiBadge } from "./ai-badge";
import { useAi } from "./ai-provider";
import { GroundingDetails } from "./grounding-details";

type Filter = "all" | "commentator" | "llm-player";

interface EntryGrounding {
  grounding: AuditGrounding;
  /** False when recomputed from the logged prompt (entries logged before checks were stored). */
  stored: boolean;
}

/** The grounding check for an entry: as stored, or recomputed for older commentary entries. */
function groundingOf(e: AuditEntry): EntryGrounding | null {
  if (e.grounding) return { grounding: e.grounding, stored: true };
  if (e.feature !== "commentator" || e.error) return null;
  const g = recheckLoggedCommentary(e.input.user, e.output);
  return g ? { grounding: g, stored: false } : null;
}

export function AiLogClient() {
  const { audit } = useAi();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(() => {
    audit
      .list()
      .then((list) => {
        setEntries(list);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [audit]);

  useEffect(() => {
    // Subscribe first, then load: both callbacks set state asynchronously.
    const unsubscribe = onAuditChange(refresh);
    const timer = setTimeout(refresh, 0);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [refresh]);

  const checks = useMemo(
    () => new Map((entries ?? []).map((e) => [e.id, groundingOf(e)] as const)),
    [entries],
  );
  const shown = useMemo(
    () => (entries ?? []).filter((e) => filter === "all" || e.feature === filter),
    [entries, filter],
  );

  const stats = useMemo(() => {
    const list = entries ?? [];
    const reviewed = list.filter((e) =>
      ["accepted", "edited", "rejected"].includes(e.humanDecision),
    );
    const checked = list.map((e) => checks.get(e.id)).filter((g) => g != null);
    return {
      calls: list.length,
      errors: list.filter((e) => e.error).length,
      checked: checked.length,
      failedChecks: checked.filter((g) => !g.grounding.passed).length,
      reviewed: reviewed.length,
      accepted: reviewed.filter((e) => e.humanDecision === "accepted").length,
      edited: reviewed.filter((e) => e.humanDecision === "edited").length,
      rejected: reviewed.filter((e) => e.humanDecision === "rejected").length,
    };
  }, [entries, checks]);

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-md">
          <Segmented
            label="Filter by feature"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "commentator", label: "Commentator" },
              { value: "llm-player", label: "LLM player" },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!shown.length}
            onClick={() =>
              downloadText(`cachex-ai-audit-${stamp}.json`, auditToJson(shown), "application/json")
            }
          >
            <Download /> JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!shown.length}
            onClick={() => downloadText(`cachex-ai-audit-${stamp}.csv`, auditToCsv(shown))}
          >
            <Download /> CSV
          </Button>
          {confirmClear ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  await audit.clear();
                  setConfirmClear(false);
                  refresh();
                }}
              >
                Yes, clear the log
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={!entries?.length}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 /> Clear
            </Button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Calls logged" value={stats.calls} />
        <Stat label="Errors" value={stats.errors} />
        <Stat
          label="Failed grounding check"
          value={stats.checked ? `${stats.failedChecks} of ${stats.checked}` : "–"}
        />
        <Stat label="Reviewed by you" value={stats.reviewed} />
        <Stat
          label="Accepted · edited · rejected"
          value={`${stats.accepted} · ${stats.edited} · ${stats.rejected}`}
        />
      </dl>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          Could not read the log: {error}
        </p>
      )}
      {entries === null && !error && <p className="text-muted-foreground text-sm">Loading…</p>}
      {entries !== null && shown.length === 0 && (
        <div className="text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
          No AI calls recorded in this browser yet. Use the commentator on /play or /spectate, or
          run the LLM Arena, with your own key.
        </div>
      )}

      <ol className="space-y-3">
        {shown.map((e) => {
          const check = checks.get(e.id) ?? null;
          return (
            <li key={e.id} className="bg-card/60 rounded-2xl border p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{FEATURE_LABEL[e.feature]}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {new Date(e.timestamp).toLocaleString("en-AU")}
                </span>
                <span className="text-muted-foreground text-xs">
                  {PROVIDER_LABEL[e.provider]} · <span className="font-mono">{e.model}</span>
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {Math.round(e.latencyMs).toLocaleString("en-AU")} ms
                  {e.usage
                    ? ` · ${e.usage.inputTokens} in / ${e.usage.outputTokens} out tokens`
                    : ""}
                </span>
                <span className="ml-auto flex flex-wrap gap-1.5">
                  {check && !check.grounding.passed && (
                    <span className="border-destructive/40 text-destructive rounded-full border px-2 py-0.5 text-xs">
                      Grounding check failed
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      e.humanDecision === "rejected" && "border-destructive/40 text-destructive",
                      e.humanDecision === "accepted" && "border-gold/50",
                    )}
                  >
                    {DECISION_LABEL[e.humanDecision]}
                  </span>
                </span>
              </div>
              {e.error ? (
                <div className="mt-2 space-y-1">
                  <p className="text-destructive text-sm">
                    Error ({e.error.kind}): {e.error.message}
                  </p>
                  {e.outputText && (
                    <>
                      <AiBadge />
                      <p className="text-muted-foreground text-xs">
                        Raw reply as received (it did not pass validation):
                      </p>
                      <pre
                        role="region"
                        aria-label="Raw reply"
                        tabIndex={0}
                        className="bg-background/60 focus-visible:ring-ring/50 max-h-48 overflow-auto rounded-lg border p-2 font-mono text-xs whitespace-pre-wrap outline-none focus-visible:ring-3"
                      >
                        {e.outputText}
                      </pre>
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  <AiBadge />
                  <pre
                    role="region"
                    aria-label="AI output"
                    tabIndex={0}
                    className="bg-background/60 focus-visible:ring-ring/50 max-h-48 overflow-auto rounded-lg border p-2 font-mono text-xs whitespace-pre-wrap outline-none focus-visible:ring-3"
                  >
                    {JSON.stringify(e.output, null, 2)}
                  </pre>
                </div>
              )}
              {check && (
                <GroundingDetails
                  grounding={check.grounding}
                  className="mt-2"
                  note={
                    check.stored
                      ? undefined
                      : "Recomputed from the logged prompt: this entry was logged before checks were stored with each call. Your decision will store it."
                  }
                />
              )}
              {e.humanDecision === "pending" && !e.error && (
                <ReviewControls entry={e} check={check} audit={audit} onDone={refresh} />
              )}
              {e.editedOutput !== undefined && (
                <div className="mt-2">
                  <p className="text-muted-foreground text-xs">Human-edited version</p>
                  <p className="text-sm whitespace-pre-line">{e.editedOutput}</p>
                </div>
              )}
              <details className="mt-2">
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  Exact input sent (system prompt, user prompt, schema)
                </summary>
                <pre
                  role="region"
                  aria-label="Exact input sent"
                  tabIndex={0}
                  className="bg-background/60 focus-visible:ring-ring/50 mt-2 max-h-72 overflow-auto rounded-lg border p-2 font-mono text-xs whitespace-pre-wrap outline-none focus-visible:ring-3"
                >
                  {`SYSTEM\n${e.input.system}\n\nUSER\n${e.input.user}\n\nSCHEMA ${e.input.schema}`}
                  {e.context ? `\n\nCONTEXT ${JSON.stringify(e.context)}` : ""}
                </pre>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Review an entry that was never decided where it was generated (for example
 * commentary that arrived after the visitor moved on). Same choices as the
 * commentator panel; the decision is written back to the audit entry.
 */
function ReviewControls({
  entry,
  check,
  audit,
  onDone,
}: {
  entry: AuditEntry;
  /** The check the reviewer saw; stored with the decision if the entry lacks one. */
  check: EntryGrounding | null;
  audit: AuditStore;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const decide = async (decision: HumanDecision, edited?: string) => {
    await audit.update(entry.id, {
      humanDecision: decision,
      decidedAt: new Date().toISOString(),
      ...(edited !== undefined ? { editedOutput: edited } : {}),
      ...(check && !check.stored ? { grounding: check.grounding } : {}),
    });
    setEditing(null);
    onDone();
  };
  const startEdit = () => {
    const parsed = CommentarySchema.safeParse(entry.output);
    setEditing(
      parsed.success ? commentaryToText(parsed.data) : JSON.stringify(entry.output, null, 2),
    );
  };
  if (editing !== null) {
    return (
      <div className="mt-2 space-y-2">
        <Textarea
          aria-label="Edit the AI output"
          value={editing}
          onChange={(ev) => setEditing(ev.target.value)}
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
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-xs">Not reviewed yet. Your review:</span>
      <Button size="xs" variant="outline" onClick={() => decide("accepted")}>
        <Check /> Accept
      </Button>
      <Button size="xs" variant="outline" onClick={startEdit}>
        <Pencil /> Edit
      </Button>
      <Button size="xs" variant="outline" onClick={() => decide("rejected")}>
        <X /> Reject
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-background/50 rounded-xl border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums">{value}</dd>
    </div>
  );
}
