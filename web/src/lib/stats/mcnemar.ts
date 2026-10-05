/**
 * Exact tests for paired binary outcomes.
 *
 * When two methods are scored pass/fail on the same units (e.g. "found a
 * shortest path" for two heuristics on the same boards), only the discordant
 * units carry information about the difference: b units where only the first
 * method passed and c where only the second did. Under the null hypothesis of
 * no difference each discordant unit is a fair coin, so the exact McNemar
 * test is a two-sided binomial test of min(b, c) in b + c trials at p = 1/2
 * (statsmodels `mcnemar(exact=True)`, R `binom.test(b, b + c)`).
 */

/** log C(n, k), summed term by term (exact enough for the sample sizes here). */
function logChoose(n: number, k: number): number {
  const m = Math.min(k, n - k);
  let s = 0;
  for (let i = 1; i <= m; i++) s += Math.log((n - m + i) / i);
  return s;
}

/** P(X <= k) for X ~ Binomial(n, p). */
export function binomialCdf(k: number, n: number, p = 0.5): number {
  if (!Number.isInteger(n) || n < 0 || p < 0 || p > 1) throw new RangeError("invalid binomial");
  if (k < 0) return 0;
  if (k >= n) return 1;
  if (p === 0) return 1;
  if (p === 1) return 0;
  const lp = Math.log(p);
  const lq = Math.log1p(-p);
  let total = 0;
  for (let i = 0; i <= k; i++) total += Math.exp(logChoose(n, i) + i * lp + (n - i) * lq);
  return Math.min(1, total);
}

export interface McNemarResult {
  /** Units where only the first method succeeded. */
  b: number;
  /** Units where only the second method succeeded. */
  c: number;
  /** Discordant units, b + c. */
  discordant: number;
  /** min(b, c), the binomial test statistic. */
  statistic: number;
  /** Exact two-sided p-value (1 when there are no discordant units). */
  pValue: number;
}

export function mcnemarExact(b: number, c: number): McNemarResult {
  if (![b, c].every((x) => Number.isInteger(x) && x >= 0)) {
    throw new RangeError("discordant counts must be non-negative integers");
  }
  const n = b + c;
  const statistic = Math.min(b, c);
  const pValue = n === 0 ? 1 : Math.min(1, 2 * binomialCdf(statistic, n, 0.5));
  return { b, c, discordant: n, statistic, pValue };
}
