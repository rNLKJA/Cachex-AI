/**
 * Bradley-Terry strengths from pairwise results, fitted by the
 * minorisation-maximisation (MM) algorithm of Hunter (2004).
 *
 * P(i beats j) = p_i / (p_i + p_j). Draws count as half a win to each side.
 * Strengths are returned on the log scale (theta_i = ln p_i, mean zero) and on
 * the Elo scale (400 · log10 p_i), optionally anchored to a reference player.
 *
 * `prior` adds that many virtual drawn games to every pairing that was played
 * (a light shrinkage towards equal strength). Without it, an agent that wins
 * or loses every game has an infinite maximum-likelihood strength.
 */

export interface PairOutcome {
  /** Index of the first player. */
  i: number;
  /** Index of the second player. */
  j: number;
  /** Points scored by i against j (wins + draws / 2). */
  scoreI: number;
  /** Points scored by j against i. */
  scoreJ: number;
}

export interface BradleyTerryOptions {
  /** Virtual drawn games added to each played pairing (default 1, i.e. +0.5 points each side). */
  prior?: number;
  maxIter?: number;
  tol?: number;
}

export interface BradleyTerryFit {
  /** ln p_i, centred so the mean is zero. */
  theta: number[];
  iterations: number;
  converged: boolean;
}

export function fitBradleyTerry(
  k: number,
  outcomes: readonly PairOutcome[],
  { prior = 1, maxIter = 10_000, tol = 1e-10 }: BradleyTerryOptions = {},
): BradleyTerryFit {
  // Aggregate into a symmetric matrix of points and games.
  const points = Array.from({ length: k }, () => new Float64Array(k));
  const games = Array.from({ length: k }, () => new Float64Array(k));
  for (const { i, j, scoreI, scoreJ } of outcomes) {
    if (i === j) continue;
    points[i][j] += scoreI;
    points[j][i] += scoreJ;
    games[i][j] += scoreI + scoreJ;
    games[j][i] += scoreI + scoreJ;
  }
  if (prior > 0) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        if (i !== j && games[i][j] > 0) {
          points[i][j] += prior / 2;
          games[i][j] += prior;
        }
      }
    }
  }

  const wins = points.map((row) => row.reduce((s, v) => s + v, 0));
  let p = new Float64Array(k).fill(1);
  let iterations = 0;
  let converged = false;
  for (; iterations < maxIter; iterations++) {
    const next = new Float64Array(k);
    for (let i = 0; i < k; i++) {
      let denom = 0;
      for (let j = 0; j < k; j++) {
        if (i !== j && games[i][j] > 0) denom += games[i][j] / (p[i] + p[j]);
      }
      next[i] = denom > 0 ? wins[i] / denom : p[i];
    }
    // Normalise to geometric mean 1 so the fit is identifiable.
    const logMean = next.reduce((s, v) => s + Math.log(v), 0) / k;
    const scale = Math.exp(logMean);
    let change = 0;
    for (let i = 0; i < k; i++) {
      next[i] /= scale;
      change = Math.max(change, Math.abs(Math.log(next[i]) - Math.log(p[i])));
    }
    p = next;
    if (change < tol) {
      converged = true;
      iterations++;
      break;
    }
  }
  const theta = Array.from(p, (v) => Math.log(v));
  const centre = theta.reduce((s, v) => s + v, 0) / k;
  return { theta: theta.map((t) => t - centre), iterations, converged };
}

/** Convert natural-log strengths to Elo points (400 per factor of 10 in odds). */
export const ELO_PER_NAT = 400 / Math.LN10;

export function toElo(theta: readonly number[], anchor?: number): number[] {
  const offset = anchor === undefined ? 0 : theta[anchor];
  return theta.map((t) => (t - offset) * ELO_PER_NAT);
}

/** Expected score of a player rated `a` against one rated `b` on the Elo scale. */
export const eloExpected = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));
