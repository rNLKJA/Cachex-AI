/**
 * The original A* iterates `HexNode.next`, a Python `set` of (r, q) tuples.
 * Because the priority queue breaks ties by insertion order, the order in
 * which neighbours come out of that set decides which of several equal-cost
 * paths is returned (and how many nodes are expanded).
 *
 * To reproduce the original output exactly, this module simulates CPython
 * 3.8+ semantics: the xxHash-based tuple hash and the open-addressing set
 * table (linear probes of 9, perturbation shift 5, resize when 3/5 full).
 * Parity is checked against CPython 3.12 in the vitest suite.
 */
import type { Coord } from "@/lib/cachex/types";

const MASK64 = (1n << 64n) - 1n;
const XXPRIME_1 = 11400714785074694791n;
const XXPRIME_2 = 14029467366897019727n;
const XXPRIME_5 = 2870177450012600261n;
const LINEAR_PROBES = 9;
const PERTURB_SHIFT = 5n;
const SET_MINSIZE = 8;

function intHash(k: number): bigint {
  // hash(-1) == -2 in CPython; every other small int hashes to itself.
  const h = k === -1 ? -2n : BigInt(k);
  return h & MASK64; // unsigned (size_t) view of Py_hash_t
}

/** `hash((a, b, ...))` for small ints, as an unsigned 64-bit value. */
export function pythonTupleHash(items: readonly number[]): bigint {
  let acc = XXPRIME_5;
  for (const item of items) {
    acc = (acc + intHash(item) * XXPRIME_2) & MASK64;
    acc = ((acc << 31n) | (acc >> 33n)) & MASK64;
    acc = (acc * XXPRIME_1) & MASK64;
  }
  acc = (acc + (BigInt(items.length) ^ (XXPRIME_5 ^ 3527539n))) & MASK64;
  if (acc === MASK64) return 1546275796n;
  return acc;
}

/** Signed view, for comparing with Python's `hash()` output. */
export const toSigned64 = (h: bigint) => (h >= 1n << 63n ? h - (1n << 64n) : h);

type Slot = { key: string; hash: bigint } | "dummy" | null;

class PySetSimulator {
  table: Slot[] = new Array<Slot>(SET_MINSIZE).fill(null);
  mask = SET_MINSIZE - 1;
  fill = 0;
  used = 0;

  add(key: string, hash: bigint): void {
    const mask = BigInt(this.mask);
    let i = hash & mask;
    let perturb = hash;
    let freeslot: number | null = null;
    for (;;) {
      let idx = Number(i);
      let probes = idx + LINEAR_PROBES <= this.mask ? LINEAR_PROBES : 0;
      do {
        const slot = this.table[idx];
        if (slot === null) {
          if (freeslot !== null) {
            this.used++;
            this.table[freeslot] = { key, hash };
            return;
          }
          this.fill++;
          this.used++;
          this.table[idx] = { key, hash };
          if (this.fill * 5 >= this.mask * 3) this.resize(this.used * 4);
          return;
        }
        if (slot === "dummy") {
          if (freeslot === null) freeslot = idx;
        } else if (slot.hash === hash && slot.key === key) {
          return; // already present
        }
        idx++;
      } while (probes-- > 0);
      perturb >>= PERTURB_SHIFT;
      i = (i * 5n + 1n + perturb) & mask;
    }
  }

  private resize(minused: number): void {
    let newsize = SET_MINSIZE;
    while (newsize <= minused) newsize <<= 1;
    const old = this.table;
    this.table = new Array<Slot>(newsize).fill(null);
    this.mask = newsize - 1;
    this.fill = this.used;
    for (const slot of old) {
      if (slot !== null && slot !== "dummy") this.insertClean(slot.key, slot.hash);
    }
  }

  private insertClean(key: string, hash: bigint): void {
    const mask = BigInt(this.mask);
    let perturb = hash;
    let i = hash & mask;
    for (;;) {
      let idx = Number(i);
      if (this.table[idx] === null) {
        this.table[idx] = { key, hash };
        return;
      }
      if (idx + LINEAR_PROBES <= this.mask) {
        for (let j = 0; j < LINEAR_PROBES; j++) {
          idx++;
          if (this.table[idx] === null) {
            this.table[idx] = { key, hash };
            return;
          }
        }
      }
      perturb >>= PERTURB_SHIFT;
      i = (i * 5n + 1n + perturb) & mask;
    }
  }

  discard(key: string): void {
    const idx = this.table.findIndex((s) => s !== null && s !== "dummy" && s.key === key);
    if (idx >= 0) {
      this.table[idx] = "dummy";
      this.used--;
    }
  }

  keys(): string[] {
    const out: string[] = [];
    for (const slot of this.table) if (slot !== null && slot !== "dummy") out.push(slot.key);
    return out;
  }
}

/** Per-board-size cache of neighbour orders (only a few sizes are kept). */
const cache = new Map<number, (Coord[] | undefined)[]>();
const MAX_CACHED_SIZES = 4;
const hashCache = new Map<string, bigint>();

function cellHash(a: number, b: number): bigint {
  const key = `${a},${b}`;
  let h = hashCache.get(key);
  if (h === undefined) {
    h = pythonTupleHash([a, b]);
    hashCache.set(key, h);
  }
  return h;
}

/**
 * `HexNode.find_next_moves` for cell (r, q) on an n×n board, returned in the
 * order CPython iterates the resulting set.
 */
export function pythonNeighbourOrder(n: number, r: number, q: number): Coord[] {
  let perSize = cache.get(n);
  if (!perSize) {
    perSize = new Array(n * n);
    cache.set(n, perSize);
    if (cache.size > MAX_CACHED_SIZES) cache.delete(cache.keys().next().value!);
  }
  const hit = perSize[r * n + q];
  if (hit) return hit;

  const set = new PySetSimulator();
  const inBoard = (a: number, b: number) => a >= 0 && a < n && b >= 0 && b < n;
  for (let a = r - 1; a < r + 2; a++) {
    for (let b = q - 1; b < q + 2; b++) {
      if (inBoard(a, b)) set.add(`${a},${b}`, cellHash(a, b));
    }
  }
  // remove the two diagonal cells along the major axis, and the cell itself
  set.discard(`${r - 1},${q - 1}`);
  set.discard(`${r + 1},${q + 1}`);
  set.discard(`${r},${q}`);

  const order = set.keys().map((k) => k.split(",").map(Number) as unknown as Coord);
  perSize[r * n + q] = order;
  return order;
}
