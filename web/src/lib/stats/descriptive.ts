/** Descriptive statistics. Every function treats its input as read-only. */

export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  return sum(xs) / xs.length;
}

/** Sample variance (ddof = 1 by default, like R's var and numpy's var(ddof=1)). */
export function variance(xs: readonly number[], ddof = 1): number {
  if (xs.length - ddof <= 0) return NaN;
  const m = mean(xs);
  let ss = 0;
  for (const x of xs) ss += (x - m) ** 2;
  return ss / (xs.length - ddof);
}

export const sd = (xs: readonly number[], ddof = 1) => Math.sqrt(variance(xs, ddof));

/**
 * Quantile with linear interpolation between order statistics: R's default
 * type 7 and numpy's default "linear" method.
 */
export function quantile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return quantileSorted(sorted, p);
}

/** As `quantile`, for input that is already sorted ascending. */
export function quantileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[n - 1];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export const median = (xs: readonly number[]) => quantile(xs, 0.5);

/** Geometric mean of strictly positive values. */
export function geometricMean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  return Math.exp(mean(xs.map(Math.log)));
}

/**
 * Average ranks (1-based) with ties sharing the mean of the ranks they span,
 * plus the sizes of each tie group (used for variance corrections).
 */
export function rankWithTies(xs: readonly number[]): { ranks: number[]; tieSizes: number[] } {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(xs.length);
  const tieSizes: number[] = [];
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k][1]] = avg;
    tieSizes.push(j - i + 1);
    i = j + 1;
  }
  return { ranks, tieSizes };
}
