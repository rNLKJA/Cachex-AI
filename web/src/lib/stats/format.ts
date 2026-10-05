/** Consistent number formatting for estimates and intervals (en-AU). */

export function formatPct(p: number, digits = 1): string {
  if (!Number.isFinite(p)) return "–";
  return `${(p * 100).toFixed(digits)}%`;
}

/** "[83.4%, 93.8%]" */
export function formatPctInterval(lower: number, upper: number, digits = 1): string {
  return `[${formatPct(lower, digits)}, ${formatPct(upper, digits)}]`;
}

export function formatNumber(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return x > 0 ? "+∞" : x < 0 ? "−∞" : "–";
  const s = x.toLocaleString("en-AU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return s.replace(/^-/, "−");
}

export function formatSigned(x: number, digits = 1): string {
  const s = formatNumber(x, digits);
  return x > 0 ? `+${s}` : s;
}

/** "[−12.3, 4.5]" */
export function formatInterval(lower: number, upper: number, digits = 1): string {
  return `[${formatNumber(lower, digits)}, ${formatNumber(upper, digits)}]`;
}

/** p-values: "< 0.001" or three significant decimals. */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return "–";
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
}

/** A p-value as a statement: "p < 0.001" or "p = 0.012". */
export function formatPStatement(p: number): string {
  const v = formatP(p);
  return v.startsWith("<") || v === "–" ? `p ${v}` : `p = ${v}`;
}
