/**
 * Build-time access to the documentation rendered under /methods (a synced
 * copy of the repository's docs/ folder; see scripts/sync-docs.mjs).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const DOCS_DIR = path.join(process.cwd(), "content", "docs");

export interface DecisionRecord {
  /** File name without .md, used as the URL slug. */
  slug: string;
  /** "DR-001" */
  id: string;
  title: string;
}

export function readDoc(relative: string): string {
  return readFileSync(path.join(DOCS_DIR, relative), "utf8");
}

/** "# DR-001: Evaluation function…" → { id: "DR-001", title: "Evaluation function…" } */
export function parseTitle(markdown: string): { id: string | null; title: string } {
  const first = markdown.split("\n").find((l) => l.startsWith("# ")) ?? "";
  const text = first.replace(/^#\s+/, "").trim();
  const m = text.match(/^(DR-\d{3}):\s*(.*)$/);
  return m ? { id: m[1], title: m[2] } : { id: null, title: text };
}

export function listDecisions(): DecisionRecord[] {
  return readdirSync(path.join(DOCS_DIR, "decisions"))
    .filter((f) => /^DR-\d{3}-.+\.md$/.test(f))
    .sort()
    .map((file) => {
      const { id, title } = parseTitle(readDoc(path.join("decisions", file)));
      return { slug: file.replace(/\.md$/, ""), id: id ?? file.slice(0, 6), title };
    });
}

/**
 * Later records that supersede this one, in whole or in part: their
 * "**Supersedes:**" line names it (and does not start with "nothing").
 * Past records are never edited, so the link is shown on the old record's
 * page from the new record's side.
 */
export function supersededBy(id: string): DecisionRecord[] {
  return listDecisions().filter((d) => {
    if (d.id <= id) return false;
    const line =
      readDoc(path.join("decisions", `${d.slug}.md`))
        .split("\n")
        .find((l) => l.includes("**Supersedes:**")) ?? "";
    const claim = line.split("**Supersedes:**")[1]?.split("**Superseded by:**")[0]?.trim() ?? "";
    return !/^nothing\b/i.test(claim) && new RegExp(`\\b${id}\\b`).test(claim);
  });
}

/** The markdown without its top-level heading (the page renders its own). */
export const withoutTitle = (markdown: string) => markdown.replace(/^#\s+.*\n+/, "");
