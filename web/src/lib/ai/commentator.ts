/**
 * The move commentator: turns the agent's own explanation of a move (search
 * depth, candidate scores and the evaluation-feature breakdown) into plain
 * English, using only those facts.
 *
 * Grounding is enforced twice: the prompt passes nothing but the facts and
 * forbids anything else, and `groundingCheck` verifies the reply against the
 * facts afterwards (feature directions must match the sign of their
 * contribution, every number and move mentioned must appear in the input).
 * The check is shown next to the commentary; the human then accepts, edits or
 * rejects it, and that decision is written to the audit log.
 */
import { z } from "zod";

import type { FeatureContribution, FeatureId } from "@/lib/agent/evaluation";
import type { MoveExplanation } from "@/lib/agent/player";
import type { Action, Colour } from "@/lib/cachex/types";
import type { StructuredRequest } from "./types";

export const FEATURE_IDS = [
  "empty",
  "triangle",
  "tokens",
  "location",
  "diamond",
  "weakness",
] as const;

export const CommentarySchema = z.object({
  summary: z.string().describe("Two or three plain-English sentences explaining the move."),
  key_factors: z
    .array(
      z.object({
        feature: z.enum(FEATURE_IDS),
        effect: z.enum(["favours_red", "favours_blue", "neutral"]),
        evidence: z.string().describe("The numbers from the facts that support this."),
      }),
    )
    .describe("The two or three features that mattered most, from the facts only."),
  caveat: z.string().describe("What the facts cannot tell us about this move."),
});

export type Commentary = z.infer<typeof CommentarySchema>;

type Num = number | string;
const num = (x: number): Num =>
  x === Infinity
    ? "+infinity (forced win for Red)"
    : x === -Infinity
      ? "-infinity (forced win for Blue)"
      : Math.round(x * 100) / 100;

const moveLabel = (a: Action) => (a[0] === "STEAL" ? "STEAL" : `(${a[1]}, ${a[2]})`);

export interface CommentaryFacts {
  board_size: number;
  turn: number;
  mover: "Red" | "Blue";
  mover_goal: string;
  chosen_move: string;
  score_convention: string;
  search: { depth: number; nodes_visited: number; chosen_score: Num; note: string | null };
  top_candidates: { move: string; score: Num }[];
  features_after_move: {
    feature: FeatureId;
    label: string;
    description: string;
    weight: number;
    counts_for: "Red minus Blue" | "both players (shared)";
    red: number | null;
    blue: number | null;
    shared: number | null;
    contribution: number;
  }[];
  evaluation_total: number;
}

export function buildCommentaryFacts({
  n,
  turn,
  colour,
  action,
  explanation,
}: {
  n: number;
  turn: number;
  colour: Colour;
  action: Action;
  explanation: Extract<MoveExplanation, { kind: "search" }>;
}): CommentaryFacts {
  const sign = colour === "red" ? -1 : 1;
  const candidates = [...explanation.candidates]
    .sort((a, b) => (a.score === b.score ? 0 : sign * (a.score - b.score) < 0 ? -1 : 1))
    .slice(0, 5);
  const features = explanation.features.map((f: FeatureContribution) => ({
    feature: f.id,
    label: f.label,
    description: f.description,
    weight: f.sign * f.weight,
    counts_for: f.value !== null ? ("both players (shared)" as const) : ("Red minus Blue" as const),
    red: f.red,
    blue: f.blue,
    shared: f.value,
    contribution: Math.round(f.contribution * 100) / 100,
  }));
  return {
    board_size: n,
    turn,
    mover: colour === "red" ? "Red" : "Blue",
    mover_goal:
      colour === "red"
        ? "Red wins by linking the top edge (r = 0) to the bottom edge (r = n - 1)."
        : "Blue wins by linking the left edge (q = 0) to the right edge (q = n - 1).",
    chosen_move: moveLabel(action),
    score_convention:
      "All scores are from Red's point of view: higher is better for Red, lower is better for Blue. Red picks the highest score, Blue the lowest.",
    search: {
      depth: explanation.depth,
      nodes_visited: explanation.nodes,
      chosen_score: num(explanation.score),
      note:
        explanation.depth > 1
          ? "With alpha-beta pruning, scores of moves other than the chosen one may be bounds rather than exact values."
          : null,
    },
    top_candidates: candidates.map((c) => ({ move: moveLabel(c.action), score: num(c.score) })),
    features_after_move: features,
    evaluation_total: Math.round(features.reduce((s, f) => s + f.contribution, 0) * 100) / 100,
  };
}

export const COMMENTATOR_SYSTEM = `You explain a single move made by a computer agent in the board game Cachex.

Rules for your answer:
- Use ONLY the facts in the JSON you are given. They come from the agent's own search and evaluation function.
- Do not describe game rules, strategies, threats, plans or future moves that are not in the facts. Do not speculate about why the programmers chose the weights.
- Every number you mention must appear in the facts. Refer to moves exactly as written in the facts, e.g. (2, 3).
- Explain which evaluation features pushed the score, using their labels, and whether each favours Red (positive contribution) or Blue (negative contribution).
- If the facts cannot explain something (for example why one candidate beat another by a small margin), say so in the caveat.
- Write for a general audience in plain Australian English. Keep the summary under 80 words.`;

export function commentaryPrompt(facts: CommentaryFacts): { system: string; user: string } {
  return {
    system: COMMENTATOR_SYSTEM,
    user: `Explain this move using only these facts.\n\nFacts (JSON):\n${JSON.stringify(facts, null, 2)}`,
  };
}

/**
 * Output-token budget for one commentary. The reply itself is a few hundred
 * tokens, but on reasoning models the budget also has to cover thinking
 * (Claude Sonnet 5.5 runs adaptive thinking by default, and OpenAI counts
 * reasoning tokens in `max_completion_tokens`), so it matches the LLM
 * player's budget. It is a ceiling, not a charge: providers bill the tokens
 * actually generated. A reply that still hits it is reported as "truncated".
 */
export const COMMENTATOR_MAX_TOKENS = 4096;

/** The full structured request for one commentary, as sent to either provider. */
export function commentaryRequest(facts: CommentaryFacts): StructuredRequest<Commentary> {
  return {
    feature: "commentator",
    ...commentaryPrompt(facts),
    schema: CommentarySchema,
    schemaName: "move_commentary",
    maxTokens: COMMENTATOR_MAX_TOKENS,
  };
}

export interface GroundingCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface GroundingResult {
  passed: boolean;
  checks: GroundingCheck[];
}

const expectedEffect = (contribution: number) =>
  contribution > 0 ? "favours_red" : contribution < 0 ? "favours_blue" : "neutral";

/** Every number that appears in the facts, as strings at the precisions a writer might use. */
function factNumbers(facts: CommentaryFacts): Set<string> {
  const out = new Set<string>();
  const add = (x: number) => {
    if (!Number.isFinite(x)) return;
    for (const v of [x, Math.abs(x)]) {
      out.add(String(v));
      out.add(String(Math.round(v)));
      out.add(v.toFixed(1));
      out.add(v.toFixed(2));
      out.add(String(Math.round(v * 10) / 10));
    }
  };
  const walk = (node: unknown) => {
    if (typeof node === "number") add(node);
    else if (typeof node === "string") {
      for (const m of node.matchAll(/-?\d+(?:\.\d+)?/g)) add(Number(m[0]));
    } else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") Object.values(node).forEach(walk);
  };
  walk(facts);
  // Counts the writer may naturally use ("two features", "one ply").
  for (let i = 0; i <= 6; i++) out.add(String(i));
  return out;
}

/**
 * Numbers written in a piece of text. A number may end a sentence ("was
 * 12.34."), so a following full stop only blocks a match when a digit comes
 * after it; numbers glued to letters ("r2", "3x") are not counted.
 */
export function mentionedNumbers(text: string): string[] {
  return [...text.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?(?!\w|\.\d)/g)].map((m) => m[0]);
}

export function groundingCheck(output: Commentary, facts: CommentaryFacts): GroundingResult {
  const checks: GroundingCheck[] = [];
  const byId = new Map(facts.features_after_move.map((f) => [f.feature, f]));

  // 1. Every cited feature exists and its direction matches its contribution.
  const wrong = output.key_factors.filter((k) => {
    const f = byId.get(k.feature);
    return !f || expectedEffect(f.contribution) !== k.effect;
  });
  checks.push({
    label: "Feature directions match the evaluation",
    ok: wrong.length === 0,
    detail:
      wrong.length === 0
        ? `${output.key_factors.length} cited feature${output.key_factors.length === 1 ? "" : "s"}, all consistent with the sign of their contribution.`
        : wrong
            .map((k) => {
              const f = byId.get(k.feature);
              return f
                ? `${f.label}: says ${k.effect.replace("_", " ")}, but its contribution is ${f.contribution} (${expectedEffect(f.contribution).replace("_", " ")}).`
                : `${k.feature}: not in the input.`;
            })
            .join(" "),
  });

  // 2. Every number mentioned appears in the facts.
  const text = [output.summary, output.caveat, ...output.key_factors.map((k) => k.evidence)].join(
    " ",
  );
  const known = factNumbers(facts);
  const mentioned = mentionedNumbers(text);
  const unknown = [
    ...new Set(mentioned.filter((m) => !known.has(m) && !known.has(String(Number(m))))),
  ];
  checks.push({
    label: "Numbers come from the input",
    ok: unknown.length === 0,
    detail:
      unknown.length === 0
        ? `${mentioned.length} number${mentioned.length === 1 ? "" : "s"} mentioned, all found in the input.`
        : `Not in the input: ${unknown.join(", ")}.`,
  });

  // 3. Every move mentioned is the chosen move or a listed candidate.
  const moves = new Set([facts.chosen_move, ...facts.top_candidates.map((c) => c.move)]);
  const cited = [...text.matchAll(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/g)].map((m) => `(${m[1]}, ${m[2]})`);
  const strange = [...new Set(cited.filter((m) => !moves.has(m)))];
  checks.push({
    label: "Moves come from the input",
    ok: strange.length === 0,
    detail:
      strange.length === 0
        ? cited.length
          ? `${cited.length} move reference${cited.length === 1 ? "" : "s"}, all the chosen move or a listed candidate.`
          : "No coordinates mentioned."
        : `Not among the chosen move or candidates: ${strange.join(", ")}.`,
  });

  // 4. Whenever a colour is said to have made a move, it is the colour that moved.
  const claimed = [...text.matchAll(MOVER_CLAIM)].map((m) => m[1]);
  const misnamed = claimed.filter((c) => c.toLowerCase() !== facts.mover.toLowerCase());
  checks.push({
    label: "The right player made the move",
    ok: misnamed.length === 0,
    detail:
      misnamed.length === 0
        ? claimed.length
          ? `Says ${facts.mover} made the move, as in the input.`
          : "Does not say which player moved."
        : `Says ${misnamed[0]} made a move, but the mover in the input is ${facts.mover}.`,
  });

  return { passed: checks.every((c) => c.ok), checks };
}

/**
 * "Red played", "Blue chose", "Red has taken": a colour directly followed by a
 * move verb. Narrow on purpose, so that naming the other colour ("it blocks
 * Red", "Red's tiles") is not mistaken for a claim about who moved.
 */
const MOVER_CLAIM =
  /\b(red|blue)\s+(?:has\s+|then\s+|now\s+)?(?:played|plays|placed|places|chose|chooses|picked|picks|selected|selects|took|takes|taken|stole|steals)\b/gi;

/** Plain-text rendering, used as the starting point when the human edits. */
export function commentaryToText(c: Commentary): string {
  return [
    c.summary,
    ...c.key_factors.map((k) => `• ${k.evidence}`),
    c.caveat ? `Caveat: ${c.caveat}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
