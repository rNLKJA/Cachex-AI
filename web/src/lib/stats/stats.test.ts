/**
 * Reference values were computed with scipy 1.17.1 / statsmodels (uv, Python
 * 3.12) and cross-checked with R 4.x (prop.test(correct = FALSE),
 * wilcox.test, quantile(type = 7), binom.test). See "Verifying the statistics" in the
 * README.
 */
import { describe, expect, it } from "vitest";

import { bootstrap, bootstrapMean, pairedMeanDifference, stratifiedBootstrap } from "./bootstrap";
import { type PairOutcome, eloExpected, fitBradleyTerry, toElo } from "./bradley-terry";
import { geometricMean, mean, median, quantile, rankWithTies, sd, variance } from "./descriptive";
import { formatP, formatPct, formatPctInterval, formatSigned } from "./format";
import { erf, normalCdf, normalQuantile, normalSf, zCritical } from "./normal";
import { binomialCdf, mcnemarExact } from "./mcnemar";
import { cohensH, newcombeDifference, wilson } from "./proportion";
import { wilcoxonSignedRank } from "./wilcoxon";

describe("normal distribution", () => {
  it("matches scipy.stats.norm", () => {
    expect(normalCdf(1.2345)).toBeCloseTo(0.8914916766373298, 14);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963984540054, 12);
    expect(normalQuantile(0.001)).toBeCloseTo(-3.090232306167813, 11);
    expect(normalSf(3.5) / 0.00023262907903552502).toBeCloseTo(1, 12);
    expect(zCritical(0.95)).toBeCloseTo(1.959963984540054, 12);
  });

  it("is symmetric and handles the extremes", () => {
    expect(normalCdf(0)).toBe(0.5);
    expect(normalCdf(-2) + normalCdf(2)).toBeCloseTo(1, 15);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 15);
    expect(normalQuantile(0)).toBe(-Infinity);
    expect(normalQuantile(1)).toBe(Infinity);
    expect(normalQuantile(2)).toBeNaN();
    for (const p of [1e-8, 0.01, 0.3, 0.5, 0.77, 0.999999]) {
      expect(normalCdf(normalQuantile(p)) / p).toBeCloseTo(1, 10);
    }
  });
});

describe("descriptive statistics", () => {
  const a = [3.1, 0.2, 5.5, 2.2, 9.9, 4.4, 1.0];

  it("matches numpy (ddof = 1) and R type-7 quantiles", () => {
    expect(variance(a)).toBeCloseTo(10.716190476190476, 12);
    expect(sd(a)).toBeCloseTo(3.2735592977965857, 12);
    const expected = [0.32, 1.6, 3.1, 7.26, 9.24];
    [0.025, 0.25, 0.5, 0.9, 0.975].forEach((p, i) =>
      expect(quantile(a, p)).toBeCloseTo(expected[i], 12),
    );
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(mean([])).toBeNaN();
    expect(geometricMean([1, 100])).toBeCloseTo(10, 12);
  });

  it("does not mutate its input", () => {
    const copy = [...a];
    quantile(a, 0.3);
    expect(a).toEqual(copy);
  });

  it("assigns average ranks to ties", () => {
    const { ranks, tieSizes } = rankWithTies([10, 20, 10, 30, 20, 20]);
    expect(ranks).toEqual([1.5, 4, 1.5, 6, 4, 4]);
    expect(tieSizes.sort()).toEqual([1, 2, 3]);
  });
});

describe("Wilson score interval", () => {
  // statsmodels proportion_confint(method="wilson"); R prop.test(correct = FALSE)
  it.each([
    [144, 160, 0.8437374796961266, 0.9375055641666694],
    [0, 10, 0.0, 0.27753279986288926],
    [10, 10, 0.7224672001371106, 1.0],
    [7, 20, 0.18119182410108203, 0.5671457233147638],
    [1, 4, 0.0455872608097006, 0.6993581574175982],
    [17, 20, 0.639581135259243, 0.9476312541037833],
    [50, 100, 0.4038315303659956, 0.5961684696340044],
  ])("%i / %i", (x, n, lo, hi) => {
    const ci = wilson(x, n);
    expect(ci.p).toBeCloseTo(x / n, 15);
    expect(ci.lower).toBeCloseTo(lo, 12);
    expect(ci.upper).toBeCloseTo(hi, 12);
  });

  it("supports other confidence levels", () => {
    const ci = wilson(7, 20, 0.9);
    expect(ci.lower).toBeCloseTo(0.202260040056761, 12);
    expect(ci.upper).toBeCloseTo(0.5334873111515284, 12);
  });

  it("is uninformative with no data and rejects impossible counts", () => {
    expect(wilson(0, 0)).toMatchObject({ lower: 0, upper: 1 });
    expect(() => wilson(5, 4)).toThrow(RangeError);
    expect(() => wilson(-1, 4)).toThrow(RangeError);
  });

  it("Newcombe difference interval matches statsmodels (method newcomb)", () => {
    const cases: [number, number, number, number, number, number][] = [
      [144, 160, 30, 40, 0.02810942807812558, 0.3065002035431229],
      [17, 20, 15, 20, -0.15171072320577428, 0.3395035190745355],
      [0, 10, 5, 10, -0.7634069094874361, -0.11736746745022203],
    ];
    for (const [x1, n1, x2, n2, lo, hi] of cases) {
      const d = newcombeDifference(x1, n1, x2, n2);
      expect(d.estimate).toBeCloseTo(x1 / n1 - x2 / n2, 15);
      expect(d.lower).toBeCloseTo(lo, 12);
      expect(d.upper).toBeCloseTo(hi, 12);
    }
    expect(cohensH(0.5, 0.5)).toBe(0);
    expect(cohensH(0.9, 0.5)).toBeCloseTo(0.9272952180016122, 12);
  });
});

describe("Wilcoxon signed-rank test", () => {
  it("normal approximation with a zero and tied ranks (scipy, correction off/on)", () => {
    const x = [125, 115, 130, 140, 140, 115, 140, 125, 140, 135];
    const y = [110, 122, 125, 120, 140, 124, 123, 137, 135, 145];
    const r = wilcoxonSignedRank(x, y);
    expect(r.method).toBe("approx");
    expect(r.zeros).toBe(1);
    expect(r.n).toBe(9);
    expect(r.statistic).toBe(18);
    expect(r.pValue).toBeCloseTo(0.5936305914425295, 12);
    const c = wilcoxonSignedRank(x, y, { continuityCorrection: true });
    expect(c.pValue).toBeCloseTo(0.6352893188352069, 12);
  });

  it("exact null distribution without ties (scipy method='exact', R exact = TRUE)", () => {
    const d = [1.5, -0.3, 2.2, 3.1, -1.7, 0.9, 4.0, 2.6, -0.2, 1.1, 0.4, 5.3];
    const r = wilcoxonSignedRank(d);
    expect(r.method).toBe("exact");
    expect(r.statistic).toBe(10);
    expect(r.wPlus).toBe(68); // R's V
    expect(r.pValue).toBeCloseTo(0.02099609375, 14);
    const approx = wilcoxonSignedRank(d, undefined, { method: "approx" });
    expect(approx.pValue).toBeCloseTo(0.0229090993543566, 12);
    expect(r.rankBiserial).toBeCloseTo((68 - 10) / 78, 14);
  });

  it("drops zeros and corrects for ties (scipy; R wilcox.test V = 95.5)", () => {
    const d = [3, -1, 4, 4, 0, 2, -2, 5, 3, 0, 1, 6, -1, 2, 2, 7];
    const r = wilcoxonSignedRank(d);
    expect(r.method).toBe("approx");
    expect(r.statistic).toBe(9.5);
    expect(r.wPlus).toBe(95.5);
    expect(r.pValue).toBeCloseTo(0.00672649504011445, 12);
    expect(() => wilcoxonSignedRank(d, undefined, { method: "exact" })).toThrow(RangeError);
  });

  it("handles all-zero differences", () => {
    expect(wilcoxonSignedRank([1, 2], [1, 2])).toMatchObject({ n: 0, zeros: 2, pValue: 1 });
  });
});

describe("bootstrap", () => {
  const xs = Array.from({ length: 40 }, (_, i) => (i * 37) % 23);

  it("is reproducible for a seed and records how it was made", () => {
    const a = bootstrapMean(xs, { seed: 7, reps: 500 });
    const b = bootstrapMean(xs, { seed: 7, reps: 500 });
    expect(a).toEqual(b);
    expect(a).toMatchObject({ seed: 7, reps: 500, level: 0.95 });
    expect(a.estimate).toBeCloseTo(mean(xs), 12);
    expect(a.lower).toBeLessThan(a.estimate);
    expect(a.upper).toBeGreaterThan(a.estimate);
  });

  it("is close to the normal-theory interval for a mean", () => {
    const ci = bootstrapMean(xs, { seed: 1, reps: 4000 });
    const se = sd(xs) / Math.sqrt(xs.length);
    expect(ci.upper - ci.lower).toBeGreaterThan(2 * 1.96 * se * 0.85);
    expect(ci.upper - ci.lower).toBeLessThan(2 * 1.96 * se * 1.15);
  });

  it("collapses on a constant sample", () => {
    const ci = bootstrap([5, 5, 5], mean, { seed: 3, reps: 100 });
    expect([ci.lower, ci.estimate, ci.upper]).toEqual([5, 5, 5]);
  });

  it("stratified resampling keeps stratum sizes", () => {
    const strata = [
      [1, 1, 1],
      [0, 0, 0, 0, 0],
    ];
    const ci = stratifiedBootstrap(strata, (s) => s[0].length * 10 + s[1].length, {
      seed: 1,
      reps: 50,
    });
    expect([ci.lower, ci.upper]).toEqual([35, 35]);
  });

  it("paired difference resamples pairs", () => {
    const x = [10, 12, 9, 15, 11, 14, 13, 10];
    const y = x.map((v, i) => v - 2 - (i % 2));
    const r = pairedMeanDifference(x, y, { seed: 5, reps: 1000 });
    expect(r.meanDiff.estimate).toBeCloseTo(2.5, 12);
    expect(r.meanDiff.lower).toBeGreaterThanOrEqual(2);
    expect(r.meanDiff.upper).toBeLessThanOrEqual(3);
    expect(r.dz).toBeCloseTo(2.5 / sd(x.map((v, i) => v - y[i])), 12);
    expect(() => pairedMeanDifference([1], [1, 2], { seed: 1 })).toThrow(RangeError);
  });
});

describe("Bradley-Terry", () => {
  // wins[i][j] = wins of i over j; reference: maximum likelihood with scipy BFGS.
  const W = [
    [0, 7, 9, 10],
    [3, 0, 6, 9],
    [1, 4, 0, 6],
    [0, 1, 4, 0],
  ];
  const outcomes: PairOutcome[] = [];
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) outcomes.push({ i, j, scoreI: W[i][j], scoreJ: W[j][i] });

  it("matches the maximum-likelihood fit (no prior)", () => {
    const fit = fitBradleyTerry(4, outcomes, { prior: 0 });
    expect(fit.converged).toBe(true);
    const expected = [
      1.539924527762305, 0.37009020841656426, -0.5322860297988234, -1.3777287063800459,
    ];
    fit.theta.forEach((t, i) => expect(t).toBeCloseTo(expected[i], 6));
  });

  it("matches the fit with one virtual draw per pairing", () => {
    const fit = fitBradleyTerry(4, outcomes, { prior: 1 });
    const expected = [
      1.2976598516423081, 0.32010753473623765, -0.4507020061425011, -1.167065380236045,
    ];
    fit.theta.forEach((t, i) => expect(t).toBeCloseTo(expected[i], 6));
  });

  it("stays finite when a player wins every game, thanks to the prior", () => {
    const sweep = [
      { i: 0, j: 1, scoreI: 10, scoreJ: 0 },
      { i: 1, j: 2, scoreI: 6, scoreJ: 4 },
      { i: 0, j: 2, scoreI: 10, scoreJ: 0 },
    ];
    const fit = fitBradleyTerry(3, sweep);
    expect(fit.theta.every(Number.isFinite)).toBe(true);
    expect(fit.theta[0]).toBeGreaterThan(fit.theta[1]);
  });

  it("converts to an anchored Elo scale", () => {
    const elo = toElo([Math.LN10, 0], 1);
    expect(elo[0]).toBeCloseTo(400, 12);
    expect(elo[1]).toBe(0);
    expect(eloExpected(400, 0)).toBeCloseTo(10 / 11, 12);
  });
});

describe("formatting", () => {
  it("formats estimates the way the site shows them", () => {
    expect(formatPct(0.9)).toBe("90.0%");
    expect(formatPctInterval(0.8437, 0.9375)).toBe("[84.4%, 93.8%]");
    expect(formatSigned(-3.21)).toBe("−3.2");
    expect(formatSigned(3.21)).toBe("+3.2");
    expect(formatP(0.0004)).toBe("< 0.001");
    expect(formatP(0.0421)).toBe("0.042");
  });
});

describe("exact McNemar test", () => {
  // scipy.stats.binomtest(k, n, 0.5).pvalue, statsmodels mcnemar(exact=True),
  // R binom.test(k, n): all agree on these.
  it.each([
    [1, 106, 1.3312027775604574e-30],
    [3, 7, 0.34375],
    [0, 5, 0.0625],
    [5, 5, 1],
    [7, 13, 0.26317596435546875],
    [12, 28, 0.01658900337497471],
  ])("b = %i, c = %i matches scipy and R", (b, c, p) => {
    const r = mcnemarExact(b, c);
    expect(r.pValue / p).toBeCloseTo(1, 12);
    expect(r.discordant).toBe(b + c);
    expect(r.statistic).toBe(Math.min(b, c));
    expect(mcnemarExact(c, b).pValue).toBe(r.pValue); // symmetric
  });

  it("handles no discordant pairs and rejects bad input", () => {
    expect(mcnemarExact(0, 0).pValue).toBe(1);
    expect(() => mcnemarExact(-1, 2)).toThrow(RangeError);
    expect(() => mcnemarExact(1.5, 2)).toThrow(RangeError);
  });

  it("binomial CDF matches scipy.stats.binom.cdf", () => {
    expect(binomialCdf(1, 107)).toBeCloseTo(6.656013887802287e-31, 40);
    expect(binomialCdf(4, 15, 0.3)).toBeCloseTo(0.5154910592268434, 13);
    expect(binomialCdf(3, 10)).toBeCloseTo(0.171875, 14);
    expect(binomialCdf(-1, 10)).toBe(0);
    expect(binomialCdf(10, 10)).toBe(1);
  });
});
