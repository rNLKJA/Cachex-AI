/**
 * Wilcoxon signed-rank test for paired samples, matching
 * scipy.stats.wilcoxon(zero_method="wilcox") and R's wilcox.test(paired = TRUE).
 *
 *  - zero differences are dropped ("wilcox" zero method);
 *  - tied |differences| get average ranks and a variance correction;
 *  - "exact" uses the null distribution of W+ (only valid without ties);
 *  - "approx" is the normal approximation, optionally with a continuity
 *    correction (off by default, like scipy).
 */
import { rankWithTies } from "./descriptive";
import { normalSf } from "./normal";

export type WilcoxonMethod = "auto" | "exact" | "approx";

export interface WilcoxonOptions {
  method?: WilcoxonMethod;
  continuityCorrection?: boolean;
}

export interface WilcoxonResult {
  /** Pairs with a non-zero difference (the effective sample size). */
  n: number;
  /** Pairs dropped because the difference was zero. */
  zeros: number;
  /** Sum of ranks of positive differences (R's V statistic). */
  wPlus: number;
  wMinus: number;
  /** min(W+, W-), scipy's two-sided statistic. */
  statistic: number;
  /** Normal-approximation z (null for the exact method). */
  z: number | null;
  /** Two-sided p-value. */
  pValue: number;
  method: "exact" | "approx";
  /** Matched-pairs rank-biserial correlation (W+ - W-) / (W+ + W-), in [-1, 1]. */
  rankBiserial: number;
}

/** Number of subsets of {1..n} with each rank sum, i.e. the null distribution of W+ × 2^n. */
function signedRankCounts(n: number): number[] {
  const max = (n * (n + 1)) / 2;
  const counts = new Array<number>(max + 1).fill(0);
  counts[0] = 1;
  for (let k = 1; k <= n; k++) {
    for (let s = max; s >= k; s--) counts[s] += counts[s - k];
  }
  return counts;
}

export function wilcoxonSignedRank(
  x: readonly number[],
  y?: readonly number[],
  { method = "auto", continuityCorrection = false }: WilcoxonOptions = {},
): WilcoxonResult {
  if (y && y.length !== x.length) throw new RangeError("paired samples must have equal length");
  const diffs = y ? x.map((xi, i) => xi - y[i]) : [...x];
  const nonZero = diffs.filter((d) => d !== 0);
  const zeros = diffs.length - nonZero.length;
  const n = nonZero.length;
  if (n === 0) {
    return {
      n,
      zeros,
      wPlus: 0,
      wMinus: 0,
      statistic: 0,
      z: null,
      pValue: 1,
      method: "approx",
      rankBiserial: 0,
    };
  }

  const { ranks, tieSizes } = rankWithTies(nonZero.map(Math.abs));
  let wPlus = 0;
  let wMinus = 0;
  nonZero.forEach((d, i) => {
    if (d > 0) wPlus += ranks[i];
    else wMinus += ranks[i];
  });
  const statistic = Math.min(wPlus, wMinus);
  const hasTies = tieSizes.some((t) => t > 1);
  const rankBiserial = (wPlus - wMinus) / (wPlus + wMinus);

  const useExact = method === "exact" || (method === "auto" && n <= 50 && !hasTies && zeros === 0);

  if (useExact) {
    if (hasTies) throw new RangeError("the exact Wilcoxon test requires untied differences");
    const counts = signedRankCounts(n);
    const total = 2 ** n;
    // W+ is an integer without ties. Two-sided p = 2 · P(W+ <= min) (symmetric null).
    let tail = 0;
    for (let s = 0; s <= statistic; s++) tail += counts[s];
    const pValue = Math.min(1, (2 * tail) / total);
    return { n, zeros, wPlus, wMinus, statistic, z: null, pValue, method: "exact", rankBiserial };
  }

  const meanW = (n * (n + 1)) / 4;
  let varW = (n * (n + 1) * (2 * n + 1)) / 24;
  for (const t of tieSizes) varW -= (t * t * t - t) / 48;
  const se = Math.sqrt(varW);
  let numerator = statistic - meanW;
  if (continuityCorrection) numerator += numerator < 0 ? 0.5 : numerator > 0 ? -0.5 : 0;
  const z = se > 0 ? numerator / se : 0;
  const pValue = Math.min(1, 2 * normalSf(Math.abs(z)));
  return { n, zeros, wPlus, wMinus, statistic, z, pValue, method: "approx", rankBiserial };
}
