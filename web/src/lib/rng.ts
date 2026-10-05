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
