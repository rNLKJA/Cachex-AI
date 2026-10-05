/**
 * Port of the evaluation features in
 * coursework/Project Part B/code/_4399/eval_func.py.
 *
 * Every feature returns a per-colour count (or sum), exactly like the
 * original dictionaries, except that missing keys are reported as 0.
 */
import { CAPTURE_PATTERNS, HEX_STEPS } from "@/lib/cachex/board";
import { COLOUR_OF, SWAP_TOKEN, type Token } from "@/lib/cachex/types";
import type { AgentBoard } from "./agent-board";

export interface ColourCounts {
  red: number;
  blue: number;
}

type Step = readonly [number, number];

/** Pairs of adjacent neighbours: [steps[i], roll(steps, 1)[i]] */
export const TRIANGLE_PATTERNS: readonly (readonly [Step, Step])[] = HEX_STEPS.map(
  (n1, i) => [n1, HEX_STEPS[(i + 5) % 6]] as const,
);

/** Identical construction to the referee's capture patterns. */
export const DIAMOND_PATTERNS = CAPTURE_PATTERNS;

/** [n1, 2 * n1]: a token with an empty neighbour and a friendly token behind it. */
export const WEAK_PATTERNS: readonly (readonly [Step, Step])[] = HEX_STEPS.map(
  (n1) => [n1, [n1[0] * 2, n1[1] * 2] as const] as const,
);

function tokensAt(
  board: AgentBoard,
  r: number,
  q: number,
  pattern: readonly Step[],
): Token[] | null {
  const out: Token[] = [];
  for (const [dr, dq] of pattern) {
    const nr = r + dr;
    const nq = q + dq;
    if (!board.insideBounds(nr, nq)) return null;
    out.push(board.tokenAt(nr, nq));
  }
  return out;
}

export function tokenInTriangle(board: AgentBoard, r: number, q: number): boolean {
  const opp = board.tokenAt(r, q);
  for (const pattern of TRIANGLE_PATTERNS) {
    const t = tokensAt(board, r, q, pattern);
    if (t && t[0] === opp && t[1] === opp) return true;
  }
  return false;
}

export function tokenInDiamond(board: AgentBoard, r: number, q: number): boolean {
  const opp = board.tokenAt(r, q);
  const mid = SWAP_TOKEN[opp];
  for (const pattern of DIAMOND_PATTERNS) {
    const t = tokensAt(board, r, q, pattern);
    if (!t) continue;
    if (t[0] === opp && t[1] === mid && t[2] === 0) return true;
    if (t[0] === opp && t[1] === 0 && t[2] === mid) return true;
  }
  return false;
}

export function tokenInWeakness(board: AgentBoard, r: number, q: number): boolean {
  const opp = board.tokenAt(r, q);
  for (const pattern of WEAK_PATTERNS) {
    const t = tokensAt(board, r, q, pattern);
    if (t && t[0] === 0 && t[1] === opp) return true;
  }
  for (const pattern of DIAMOND_PATTERNS) {
    const t = tokensAt(board, r, q, pattern);
    if (t && t[0] === opp && t[1] === 0 && t[2] === 0) return true;
  }
  return false;
}

function countOccupied(
  board: AgentBoard,
  predicate: (board: AgentBoard, r: number, q: number) => boolean,
): ColourCounts {
  const result: ColourCounts = { red: 0, blue: 0 };
  for (let r = 0; r < board.n; r++) {
    for (let q = 0; q < board.n; q++) {
      const t = board.tokenAt(r, q);
      if (t !== 0 && predicate(board, r, q)) result[COLOUR_OF[t]] += 1;
    }
  }
  return result;
}

/** `token_counter` */
export const tokenCounter = (board: AgentBoard) => countOccupied(board, () => true);
/** `count_token_in_triangle` */
export const countTokenInTriangle = (board: AgentBoard) => countOccupied(board, tokenInTriangle);
/** `count_token_in_diamond` */
export const countTokenInDiamond = (board: AgentBoard) => countOccupied(board, tokenInDiamond);
/** `count_token_in_weakness` */
export const countTokenInWeakness = (board: AgentBoard) => countOccupied(board, tokenInWeakness);

const scoreMatrixCache = new Map<number, number[][]>();

/**
 * `score_matrix`: positional value of each cell, high at the rim and
 * decreasing towards the centre (the exact centre of odd boards scores 1).
 */
export function scoreMatrix(size: number): number[][] {
  const cached = scoreMatrixCache.get(size);
  if (cached) return cached;
  const m = Array.from({ length: size }, () =>
    new Array<number>(size).fill(Math.trunc((size + 3) / 2 - 1)),
  );
  for (let n = 1; n < Math.floor(size / 2); n++) {
    const value = Math.trunc((size + 3) / 2) - n;
    for (let r = n; r < size - n; r++) {
      for (let q = n; q < size - n; q++) m[r][q] = value;
    }
  }
  if (size % 2 === 1) m[Math.floor(size / 2)][Math.floor(size / 2)] = 1;
  scoreMatrixCache.set(size, m);
  return m;
}

/** `count_token_in_diff_hex_location` */
export function countTokenInDiffHexLocation(board: AgentBoard): ColourCounts {
  const s = scoreMatrix(board.n);
  const result: ColourCounts = { red: 0, blue: 0 };
  for (let r = 0; r < board.n; r++) {
    for (let q = 0; q < board.n; q++) {
      const t = board.tokenAt(r, q);
      if (t !== 0) result[COLOUR_OF[t]] += s[r][q];
    }
  }
  return result;
}

/** `n_emptyhex` (utility/evaluation.py) */
export const nEmptyHex = (board: AgentBoard) => board.emptyCount();
