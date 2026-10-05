/**
 * Small seeded PRNG (mulberry32). The original Python agents use the global
 * `random` module; in the browser we use a seeded generator so that a game can
 * be replayed exactly from its seed.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [min, max] (inclusive), like Python's randint. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function choice<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("choice() from an empty list");
  return items[Math.floor(rng() * items.length)];
}

/** In-place Fisher–Yates shuffle. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Random sample without replacement, like Python's random.sample. */
export function sample<T>(rng: Rng, items: readonly T[], k: number): T[] {
  const pool = items.slice();
  shuffle(rng, pool);
  return pool.slice(0, k);
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * Derive a 32-bit seed from a parent seed and any number of integer labels
 * (board size, pairing, round...). Uses the murmur3 finaliser so nearby
 * inputs give unrelated seeds; the same inputs always give the same seed.
 */
export function deriveSeed(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const part of parts) {
    let k = Math.imul(part | 0, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  h ^= parts.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
