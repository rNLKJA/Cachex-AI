/**
 * TypeScript port of the subject-provided referee board
 * (coursework/Project Part B/code/referee/board.py).
 *
 * Coordinates are axial (r, q) with 0 <= r, q < n. Red connects r = 0 to
 * r = n - 1; Blue connects q = 0 to q = n - 1.
 */
import { COLOUR_OF, type Colour, type Coord, SWAP_TOKEN, TOKEN_OF, type Token } from "./types";

type Step = readonly [number, number];

/** Neighbour hex steps in clockwise order (`_HEX_STEPS`). */
export const HEX_STEPS: readonly Step[] = [
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
];

const add = (a: Step, b: Step): Step => [a[0] + b[0], a[1] + b[1]];

/** numpy.roll(steps, k)[i] === steps[i - k] */
const rolled = (k: number) => HEX_STEPS.map((_, i) => HEX_STEPS[(i - k + 6) % 6]);

/**
 * Diamond capture patterns: [opposite offset, neighbour 1 offset, neighbour 2 offset].
 * "Longways" diamonds use adjacent neighbours (roll 1), "sideways" diamonds use
 * neighbours spaced apart (roll 2), so each cell is part of 6 + 6 diamonds.
 */
export const CAPTURE_PATTERNS: readonly (readonly [Step, Step, Step])[] = [
  ...HEX_STEPS.map((n1, i) => [n1, rolled(1)[i]] as const),
  ...HEX_STEPS.map((n1, i) => [n1, rolled(2)[i]] as const),
].map(([n1, n2]) => [add(n1, n2), n1, n2] as const);

export class Board {
  readonly n: number;
  data: Uint8Array;

  constructor(n: number, data?: Uint8Array) {
    this.n = n;
    this.data = data ? data.slice() : new Uint8Array(n * n);
  }

  clone(): Board {
    return new Board(this.n, this.data);
  }

  index(r: number, q: number): number {
    return r * this.n + q;
  }

  tokenAt(r: number, q: number): Token {
    return this.data[r * this.n + q] as Token;
  }

  /** `board[coord]` — the colour string or null. */
  get(r: number, q: number): Colour | null {
    const t = this.tokenAt(r, q);
    return t === 0 ? null : COLOUR_OF[t];
  }

  set(r: number, q: number, colour: Colour | null): void {
    this.data[r * this.n + q] = colour === null ? 0 : TOKEN_OF[colour];
  }

  /** Board state digest used to detect repeated states. */
  digest(): string {
    return this.data.join("");
  }

  insideBounds(r: number, q: number): boolean {
    return r >= 0 && r < this.n && q >= 0 && q < this.n;
  }

  isOccupied(r: number, q: number): boolean {
    return this.tokenAt(r, q) !== 0;
  }

  /**
   * Mirror the state along the major board axis: a matrix transpose combined
   * with swapping the player token types (the STEAL action).
   */
  swap(): void {
    const n = this.n;
    const next = new Uint8Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let q = 0; q < n; q++) {
        next[r * n + q] = SWAP_TOKEN[this.data[q * n + r] as Token];
      }
    }
    this.data = next;
  }

  /** Place a token and apply captures. Returns the captured coordinates. */
  place(colour: Colour, r: number, q: number): Coord[] {
    this.set(r, q, colour);
    return this.applyCaptures(r, q);
  }

  /** In-bounds neighbours of a coordinate, in `_HEX_STEPS` order. */
  neighbours(r: number, q: number): Coord[] {
    const out: Coord[] = [];
    for (const [dr, dq] of HEX_STEPS) {
      const nr = r + dr;
      const nq = q + dq;
      if (this.insideBounds(nr, nq)) out.push([nr, nq]);
    }
    return out;
  }

  /** Cells connected to start (same token type), found with a BFS. */
  connectedCoords(r: number, q: number): Coord[] {
    const token = this.tokenAt(r, q);
    const seen = new Set<number>();
    const queue: Coord[] = [[r, q]];
    const out: Coord[] = [];
    while (queue.length > 0) {
      const [cr, cq] = queue.shift()!;
      const key = cr * this.n + cq;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([cr, cq]);
      for (const [nr, nq] of this.neighbours(cr, cq)) {
        if (!seen.has(nr * this.n + nq) && this.tokenAt(nr, nq) === token) {
          queue.push([nr, nq]);
        }
      }
    }
    return out;
  }

  /**
   * Check the placed coordinate for diamond captures and apply them.
   * Captures are deferred so overlapping diamonds are handled correctly.
   */
  private applyCaptures(r: number, q: number): Coord[] {
    const oppType = this.tokenAt(r, q);
    const midType = SWAP_TOKEN[oppType];
    const captured = new Map<number, Coord>();

    for (const pattern of CAPTURE_PATTERNS) {
      const coords = pattern.map(([dr, dq]) => [r + dr, q + dq] as const);
      if (!coords.every(([cr, cq]) => this.insideBounds(cr, cq))) continue;
      const [a, b, c] = coords.map(([cr, cq]) => this.tokenAt(cr, cq));
      if (a === oppType && b === midType && c === midType) {
        for (const coord of coords.slice(1)) {
          captured.set(coord[0] * this.n + coord[1], coord);
        }
      }
    }

    for (const [cr, cq] of captured.values()) this.set(cr, cq, null);
    return [...captured.values()];
  }
}
