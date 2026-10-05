/**
 * Seeded percentile bootstrap. Every interval records its seed and number of
 * resamples so a result on the site can be reproduced exactly.
 */
import { createRng } from "@/lib/rng";
import { mean, quantileSorted, sd } from "./descriptive";

export interface BootstrapOptions {
  /** Number of resamples (default 2000). */
  reps?: number;
  /** Confidence level (default 0.95). */
  level?: number;
  /** Seed for the resampling RNG. */
  seed: number;
}

export interface BootstrapCI {
  /** The statistic on the original sample. */
  estimate: number;
  lower: number;
  upper: number;
  level: number;
  reps: number;
  seed: number;
}

/** Percentile interval of a bootstrap distribution (type-7 quantiles). */
export function percentileInterval(
  replicates: readonly number[],
  level: number,
): { lower: number; upper: number } {
  const finite = replicates.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return { lower: NaN, upper: NaN };
  const alpha = (1 - level) / 2;
  return { lower: quantileSorted(finite, alpha), upper: quantileSorted(finite, 1 - alpha) };
}

/** Bootstrap a statistic of one sample by resampling its elements with replacement. */
export function bootstrap<T>(
  data: readonly T[],
  statistic: (sample: readonly T[]) => number,
  { reps = 2000, level = 0.95, seed }: BootstrapOptions,
): BootstrapCI {
  const estimate = statistic(data);
  const n = data.length;
  if (n === 0) return { estimate, lower: NaN, upper: NaN, level, reps, seed };
  const rng = createRng(seed);
  const sample = new Array<T>(n);
  const replicates = new Array<number>(reps);
  for (let b = 0; b < reps; b++) {
    for (let i = 0; i < n; i++) sample[i] = data[Math.floor(rng() * n)];
    replicates[b] = statistic(sample);
  }
  return { estimate, ...percentileInterval(replicates, level), level, reps, seed };
}

/**
 * Stratified bootstrap: resample within each stratum independently, keeping
 * stratum sizes fixed (e.g. games within each pairing of a round robin).
 */
export function stratifiedBootstrap<T>(
  strata: readonly (readonly T[])[],
  statistic: (strata: readonly (readonly T[])[]) => number,
  { reps = 2000, level = 0.95, seed }: BootstrapOptions,
): BootstrapCI {
  const estimate = statistic(strata);
  const rng = createRng(seed);
  const samples = strata.map((s) => new Array<T>(s.length));
  const replicates = new Array<number>(reps);
  for (let b = 0; b < reps; b++) {
    strata.forEach((s, k) => {
      const out = samples[k];
      for (let i = 0; i < s.length; i++) out[i] = s[Math.floor(rng() * s.length)];
    });
    replicates[b] = statistic(samples);
  }
  return { estimate, ...percentileInterval(replicates, level), level, reps, seed };
}

/** Bootstrap CI for a mean. */
export const bootstrapMean = (xs: readonly number[], opts: BootstrapOptions) =>
  bootstrap(xs, mean, opts);

export interface PairedDifference {
  n: number;
  meanX: number;
  meanY: number;
  /** Mean of the paired differences x - y, with a paired bootstrap CI. */
  meanDiff: BootstrapCI;
  /** Cohen's d_z: mean difference / SD of the differences. */
  dz: number;
}

/**
 * Paired comparison of two measurements on the same units: resamples the
 * units (pairs), never the two arms independently.
 */
export function pairedMeanDifference(
  x: readonly number[],
  y: readonly number[],
  opts: BootstrapOptions,
): PairedDifference {
  if (x.length !== y.length) throw new RangeError("paired samples must have equal length");
  const d = x.map((xi, i) => xi - y[i]);
  const s = sd(d);
  return {
    n: d.length,
    meanX: mean(x),
    meanY: mean(y),
    meanDiff: bootstrapMean(d, opts),
    dz: s > 0 ? mean(d) / s : 0,
  };
}

/**
 * Stratified bootstrap of a vector-valued statistic (e.g. every player's
 * strength from one refit), with a percentile interval per component.
 */
export function stratifiedBootstrapVector<T>(
  strata: readonly (readonly T[])[],
  statistic: (strata: readonly (readonly T[])[]) => number[],
  { reps = 2000, level = 0.95, seed }: BootstrapOptions,
): {
  estimate: number[];
  lower: number[];
  upper: number[];
  level: number;
  reps: number;
  seed: number;
} {
  const estimate = statistic(strata);
  const rng = createRng(seed);
  const samples = strata.map((s) => new Array<T>(s.length));
  const replicates: number[][] = estimate.map(() => new Array<number>(reps));
  for (let b = 0; b < reps; b++) {
    strata.forEach((s, k) => {
      const out = samples[k];
      for (let i = 0; i < s.length; i++) out[i] = s[Math.floor(rng() * s.length)];
    });
    const value = statistic(samples);
    value.forEach((v, c) => (replicates[c][b] = v));
  }
  const intervals = replicates.map((r) => percentileInterval(r, level));
  return {
    estimate,
    lower: intervals.map((i) => i.lower),
    upper: intervals.map((i) => i.upper),
    level,
    reps,
    seed,
  };
}
