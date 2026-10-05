"use client";

import { BookOpen, Dice5, Sparkles, Trophy } from "lucide-react";

import { CommentatorPanel } from "@/components/ai/commentator-panel";
import type { MoveMeta } from "@/hooks/use-cachex-match";
import type { Action, Colour } from "@/lib/cachex/types";
import { sameAction } from "@/lib/cachex/types";
import { cn } from "@/lib/utils";
import { ColourDot, colourName } from "./primitives";

/** Round to the one decimal place shown in the UI (infinities pass through). */
const roundScore = (s: number) => (Number.isFinite(s) ? Math.round(s * 10) / 10 + 0 : s);

const hasTies = (scores: number[]) => new Set(scores).size < scores.length;

export const formatScore = (s: number) =>
  s === Infinity ? "+∞" : s === -Infinity ? "−∞" : roundScore(s).toLocaleString("en-AU");

const actionLabel = (a: Action) => (a[0] === "STEAL" ? "STEAL" : `(${a[1]}, ${a[2]})`);

export function ExplainPanel({
  meta,
  action,
  colour,
  turn,
  n,
}: {
  meta: MoveMeta | undefined;
  action: Action | undefined;
  colour: Colour | undefined;
  turn: number | undefined;
  /** Board size; enables the optional AI commentary for searched moves. */
  n?: number;
}) {
  if (!meta || !action || !colour) {
    return (
      <p className="text-muted-foreground text-sm">
        When the minimax agent moves, its reasoning appears here: the opening book, an instant win,
        or the scores its search assigned to each candidate and the evaluation features behind the
        chosen move.
      </p>
    );
  }

  const { explanation, elapsedMs } = meta;
  const header = (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <ColourDot colour={colour} />
      <span className="font-medium">
        Turn {turn}: {colourName(colour)} played{" "}
        <span className="font-mono">{actionLabel(action)}</span>
      </span>
      <span className="text-muted-foreground text-xs">
        in {elapsedMs < 1 ? "<1" : Math.round(elapsedMs)} ms
      </span>
    </div>
  );

  if (explanation.kind === "opening") {
    return (
      <div>
        {header}
        <Callout icon={BookOpen} title="Opening book">
          {explanation.rule} The first two moves are hard-coded in the original agent rather than
          searched.
        </Callout>
      </div>
    );
  }
  if (explanation.kind === "instant-win") {
    return (
      <div>
        {header}
        <Callout icon={Trophy} title="Instant win">
          Before searching, the agent tries every legal move and plays one that completes a winning
          chain immediately.
        </Callout>
      </div>
    );
  }
  if (explanation.kind === "random") {
    return (
      <div>
        {header}
        <Callout icon={Dice5} title="Random baseline">
          Picked uniformly from {explanation.options} option{explanation.options === 1 ? "" : "s"}.
        </Callout>
      </div>
    );
  }

  const { depth, nodes, candidates, features, score } = explanation;
  // Show the chosen move first among equal scores, then bar lengths by how
  // good each candidate is for the mover (Red wants high, Blue wants low).
  const sign = colour === "red" ? 1 : -1;
  const ordered = [...candidates].sort((a, b) => {
    const d = sign * (b.score - a.score);
    if (d !== 0 && !Number.isNaN(d)) return d;
    return Number(sameAction(b.action, action)) - Number(sameAction(a.action, action));
  });
  const top = ordered.slice(0, 6);
  // Bars compare scores at the precision they are displayed: the original
  // agent multiplies each score by a random 1 or 1 + 1e-5 to break ties, and
  // those ~1e-4 differences must not look like real gaps.
  const shownGoodness = (score: number) => sign * roundScore(score);
  const goodness = top.map((c) => shownGoodness(c.score)).filter(Number.isFinite);
  const lo = Math.min(...goodness);
  const hi = Math.max(...goodness);
  const allTied = goodness.length === 0 || hi - lo < 0.05;

  return (
    <div className="space-y-4">
      {header}
      <div className="flex flex-wrap gap-2 text-xs">
        <Stat label="Search depth" value={String(depth)} />
        <Stat label="Nodes" value={nodes.toLocaleString("en-AU")} />
        <Stat label="Score" value={formatScore(score)} />
      </div>

      <div>
        <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
          <Sparkles className="size-3.5" /> Top candidates
        </h3>
        <ul className="space-y-1.5">
          {top.map((c) => {
            const chosen = sameAction(c.action, action);
            const g = shownGoodness(c.score);
            const v = Number.isFinite(g) ? g : g > 0 ? hi : lo;
            const width = allTied ? "100%" : `${15 + ((v - lo) / (hi - lo)) * 85}%`;
            return (
              <li
                key={actionLabel(c.action)}
                className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2 text-xs"
              >
                <span className={cn("font-mono", chosen && "text-foreground font-semibold")}>
                  {actionLabel(c.action)}
                </span>
                <span className="bg-muted h-2 overflow-hidden rounded-full">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      chosen ? "bg-gold" : "bg-foreground/25",
                    )}
                    style={{ width }}
                  />
                </span>
                <span className="text-right font-mono tabular-nums">{formatScore(c.score)}</span>
              </li>
            );
          })}
        </ul>
        {top.length > 1 && hasTies(top.map((c) => roundScore(c.score))) && (
          <p className="text-muted-foreground mt-2 text-xs">
            Equal scores are broken by the original agent&apos;s random ×(1 + 10⁻⁵) bias.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Evaluation after this move
        </h3>
        <div className="relative overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">
              Evaluation features and their weighted contribution
            </caption>
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="py-1 text-left font-medium">
                  Feature
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Red
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Blue
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Weight
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.id} className="border-border/50 border-b last:border-0">
                  <th scope="row" className="py-1.5 text-left font-normal" title={f.description}>
                    {f.label}
                  </th>
                  <td
                    className="py-1.5 text-right font-mono tabular-nums"
                    colSpan={f.value !== null ? 2 : 1}
                  >
                    {f.value !== null ? `${f.value} shared` : f.red}
                  </td>
                  {f.value === null && (
                    <td className="py-1.5 text-right font-mono tabular-nums">{f.blue}</td>
                  )}
                  <td className="text-muted-foreground py-1.5 text-right font-mono tabular-nums">
                    {f.sign > 0 ? "+" : "−"}
                    {f.weight}
                  </td>
                  <td
                    className={cn(
                      "py-1.5 text-right font-mono tabular-nums",
                      f.contribution > 0 && "text-red-player-ink",
                      f.contribution < 0 && "text-blue-player-ink",
                    )}
                  >
                    {f.contribution > 0 ? "+" : ""}
                    {formatScore(f.contribution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Scores are from Red&apos;s point of view: Red maximises, Blue minimises.
          {depth > 1 &&
            " With alpha-beta pruning, scores other than the chosen move can be bounds rather than exact values."}
        </p>
      </div>

      {n !== undefined && turn !== undefined && (
        <CommentatorPanel
          key={`${n}-${turn}-${actionLabel(action)}`}
          n={n}
          turn={turn}
          colour={colour}
          action={action}
          explanation={explanation}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/50 rounded-lg border px-2.5 py-1.5">
      <div className="text-muted-foreground text-[0.65rem] tracking-wide uppercase">{label}</div>
      <div className="font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}

function Callout({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Trophy;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background/50 flex gap-3 rounded-xl border p-3 text-sm">
      <Icon className="text-gold mt-0.5 size-4 shrink-0" />
      <div>
        <div className="font-medium">{title}</div>
        <p className="text-muted-foreground mt-0.5">{children}</p>
      </div>
    </div>
  );
}
