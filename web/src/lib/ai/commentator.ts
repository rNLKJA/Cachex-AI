/**
 * The move commentator: turns the agent's own explanation of a move (search
 * depth, candidate scores and the evaluation-feature breakdown) into plain
 * English, using only those facts.
 *
 * Grounding is enforced twice: the prompt passes nothing but the facts and
 * forbids anything else, and `groundingCheck` verifies the reply against the
 * facts afterwards (feature directions must match the sign of their
 * contribution, every number and move mentioned must appear in the input,
 * the right player must be named as the mover, and a forced win found by the
 * search must be reported as one). The check is stored with the call in the
 * audit log and shown next to the commentary; the human then accepts, edits
 * or rejects it, and that decision is written to the same entry.
 *
 * The facts also say how the score relates to the feature breakdown. The
 * features always describe the position right after the move; only a
 * one-ply search scores that position directly. Deeper searches back up the
 * value of positions further ahead (or a forced win), so the features can
 * point the other way and must not be presented as the reason for the score.
 */
import { z } from "zod";

import type { FeatureContribution, FeatureId } from "@/lib/agent/evaluation";
import type { MoveExplanation } from "@/lib/agent/player";
import type { Action, Colour } from "@/lib/cachex/types";
import type { AuditCheck, AuditGrounding } from "./audit-log";
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

type Player = "Red" | "Blue";

export interface CommentaryFacts {
  board_size: number;
  turn: number;
  mover: Player;
  mover_goal: string;
  chosen_move: string;
  score_convention: string;
  search: {
    depth: number;
    nodes_visited: number;
    chosen_score: Num;
    /** Set when the search found a forced win (a score of plus or minus infinity). */
    forced_win: Player | null;
    note: string | null;
  };
  /** How the chosen score relates to the feature breakdown (it depends on the depth). */
  score_scope: string;
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
    note: string | null;
  }[];
  evaluation_total: number;
}

const SHARED_NOTE =
  "Shared: it adds the same amount whichever player moved, and apart from captures and STEAL it is the same for every candidate move, so it does not explain why this move was chosen. Its effect is neutral.";

/** The sentence that tells the model (and the reader) what the score is. */
function scoreScope(depth: number, score: number, mover: Player): string {
  if (!Number.isFinite(score)) {
    const winner: Player = score > 0 ? "Red" : "Blue";
    const why =
      winner === mover
        ? `so the agent picked a move that keeps that win`
        : `so every move ${mover} had loses against best play within the search, and the scores do not say why this one was picked`;
    return `The ${depth}-ply search found a forced win for ${winner}, ${why}. That search result, not the feature breakdown, is the reason for the score; the features describe the position right after the move.`;
  }
  if (depth > 1) {
    return `The chosen score is the minimax value of a ${depth}-ply search: the evaluation of a position ${depth} moves ahead, assuming both players play their best. It is not the sum of the feature contributions, which describe the position right after the move and can point the other way.`;
  }
  return "The search looked one move ahead, so the chosen score is the evaluation of the position right after the move: the feature contributions add up to it (apart from a random tie-break of at most 0.001%).";
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
    note: f.value !== null ? SHARED_NOTE : null,
  }));
  const mover: Player = colour === "red" ? "Red" : "Blue";
  return {
    board_size: n,
    turn,
    mover,
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
      forced_win: Number.isFinite(explanation.score)
        ? null
        : explanation.score > 0
          ? "Red"
          : "Blue",
      note:
        explanation.depth > 1
          ? "With alpha-beta pruning, scores of moves other than the chosen one may be bounds rather than exact values."
          : null,
    },
    score_scope: scoreScope(explanation.depth, explanation.score, mover),
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
- Read score_scope first: it says how the chosen score relates to the feature breakdown.
  - If search.forced_win is set, say plainly in the summary that the search found a forced win for that player. Do not explain the choice through the features.
  - If search.depth is more than 1, the features describe the position right after the move. Do not say they produced, explain or add up to the chosen score.
  - If search.depth is 1, the contributions add up to the score: explain which features pushed it.
- Name features by their labels. A feature favours Red when its contribution is positive and Blue when it is negative; a feature counted for "both players (shared)" is neutral.
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

/** One automated check of a reply against its facts (stored in the audit log). */
export type GroundingCheck = AuditCheck;
export type GroundingResult = AuditGrounding;

const expectedEffect = (contribution: number) =>
  contribution > 0 ? "favours_red" : contribution < 0 ? "favours_blue" : "neutral";

type Feature = CommentaryFacts["features_after_move"][number];

/** Shared features (empty hexes) add the same for both players: neutral is right, the sign is not wrong. */
const allowedEffects = (f: Feature): string[] =>
  f.counts_for === "both players (shared)"
    ? ["neutral", expectedEffect(f.contribution)]
    : [expectedEffect(f.contribution)];

/**
 * The forced win the search found, if any. Older facts (logged before
 * `forced_win` existed) carry it only in the chosen score's label.
 */
export function forcedWinner(facts: CommentaryFacts): Player | null {
  if (facts.search.forced_win) return facts.search.forced_win;
  const label = String(facts.search.chosen_score);
  const m = label.match(/forced win for (Red|Blue)/);
  return m ? (m[1] as Player) : null;
}

/** "forced win", "forces a win", "can force a win", "forcing win". */
const FORCED_WIN = /\bforc(?:e|es|ed|ing)\s+(?:a\s+)?win\b/gi;
/** A colour attached to a forced win: "forced win for Blue", "Blue can force a win". */
const FORCED_FOR =
  /\bforc(?:e|es|ed|ing)\s+(?:a\s+)?win\s+for\s+(red|blue)\b|\b(red|blue)\s+(?:can\s+|could\s+|will\s+)?forc(?:e|es|ed|ing)\s+(?:a\s+)?win\b/gi;
const NEGATED = /\b(?:no|not|never|without|nor)\b[^.]{0,24}$/i;

/** Mentions of a forced win that are claims, not denials ("no forced win was found"). */
function forcedWinClaims(text: string): number {
  return [...text.matchAll(FORCED_WIN)].filter((m) => !NEGATED.test(text.slice(0, m.index))).length;
}

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
    return !f || !allowedEffects(f).includes(k.effect);
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

  // 5. A forced win found by the search is reported, for the right player, and
  //    never claimed when the search did not find one.
  const winner = forcedWinner(facts);
  const claims = forcedWinClaims(output.summary);
  const wrongFor = [...text.matchAll(FORCED_FOR)]
    .map((m) => (m[1] ?? m[2]).toLowerCase())
    .filter((c) => !winner || c !== winner.toLowerCase());
  const forcedOk = winner
    ? claims > 0 && wrongFor.length === 0
    : forcedWinClaims(text) === 0 && wrongFor.length === 0;
  checks.push({
    label: "Forced wins reported as the search found them",
    ok: forcedOk,
    detail: winner
      ? forcedOk
        ? `Reports the forced win for ${winner} that the search found.`
        : wrongFor.length
          ? `Gives the forced win to ${wrongFor[0] === "red" ? "Red" : "Blue"}, but the search found one for ${winner}.`
          : `The search found a forced win for ${winner} (score ${String(facts.search.chosen_score)}), but the summary does not say so.`
      : forcedOk
        ? "The search found no forced win, and none is claimed."
        : "Claims a forced win, but the search did not find one.",
  });

  return { passed: checks.every((c) => c.ok), checks };
}

/**
 * Recover the facts from a logged prompt (the user message ends with them as
 * JSON), so entries logged before checks were stored can be re-checked on
 * /ai-log. Returns null when the prompt is not a commentary prompt.
 */
export function parseCommentaryFacts(userPrompt: string): CommentaryFacts | null {
  const marker = "Facts (JSON):\n";
  const at = userPrompt.indexOf(marker);
  if (at < 0) return null;
  try {
    const facts = JSON.parse(userPrompt.slice(at + marker.length)) as CommentaryFacts;
    const ok =
      facts &&
      typeof facts.mover === "string" &&
      typeof facts.chosen_move === "string" &&
      facts.search !== null &&
      typeof facts.search === "object" &&
      Array.isArray(facts.top_candidates) &&
      Array.isArray(facts.features_after_move);
    return ok ? facts : null;
  } catch {
    return null;
  }
}

/** Re-run the grounding check for a logged commentary call, or null if it cannot be. */
export function recheckLoggedCommentary(
  userPrompt: string,
  output: unknown,
): GroundingResult | null {
  const facts = parseCommentaryFacts(userPrompt);
  const parsed = CommentarySchema.safeParse(output);
  return facts && parsed.success ? groundingCheck(parsed.data, facts) : null;
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
