/**
 * Minimal RFC 4180 CSV writer. String cells that start with a formula
 * character are prefixed with an apostrophe so spreadsheet apps do not
 * evaluate text (for example LLM output) as a formula.
 */
export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let s = value;
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, CsvValue>>(
  rows: readonly T[],
  columns: readonly (keyof T & string)[] = rows.length
    ? (Object.keys(rows[0]) as (keyof T & string)[])
    : [],
): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
