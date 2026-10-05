/**
 * Confidence intervals for proportions.
 *
 * Wilson's score interval is used everywhere a win rate, illegal-move rate or
 * agreement rate is shown: unlike the Wald interval it behaves at 0% and 100%
 * and keeps close to nominal coverage for the small samples a browser can run.
 */
import { zCritical } from "./normal";

export interface ProportionCI {
  successes: number;
  n: number;
  /** Point estimate successes / n (NaN when n = 0). */
  p: number;
  lower: number;
  upper: number;
  level: number;
}

export function wilson(successes: number, n: number, level = 0.95): ProportionCI {
  if (!Number.isFinite(successes) || !Number.isFinite(n) || successes < 0 || successes > n) {
    throw new RangeError(`invalid proportion ${successes}/${n}`);
  }
  if (n === 0) return { successes, n, p: NaN, lower: 0, upper: 1, level };
  const z = zCritical(level);
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    successes,
    n,
    p,
    // Clamp exact endpoints so 0/n and n/n report exactly 0 and 1.
    lower: successes === 0 ? 0 : Math.max(0, centre - half),
    upper: successes === n ? 1 : Math.min(1, centre + half),
    level,
  };
}

export interface DifferenceCI {
  /** p1 - p2 */
  estimate: number;
  lower: number;
  upper: number;
  level: number;
}

/**
 * Newcombe's hybrid score interval (method 10) for the difference of two
 * independent proportions, built from the two Wilson intervals.
 */
export function newcombeDifference(
  x1: number,
  n1: number,
  x2: number,
  n2: number,
  level = 0.95,
): DifferenceCI {
  const a = wilson(x1, n1, level);
  const b = wilson(x2, n2, level);
  const d = a.p - b.p;
  const lower = d - Math.sqrt((a.p - a.lower) ** 2 + (b.upper - b.p) ** 2);
  const upper = d + Math.sqrt((a.upper - a.p) ** 2 + (b.p - b.lower) ** 2);
  return { estimate: d, lower, upper, level };
}

/** Cohen's h effect size for two proportions. */
export const cohensH = (p1: number, p2: number) =>
  2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2));
