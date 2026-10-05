/**
 * Build-time loaders for the generated study data. Read with fs (not
 * `import`) so tsc does not infer types for large JSON files; only used by
 * Server Components and route handlers, which run at build time.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { PruningSample } from "@/lib/analysis/alpha-beta";
import type { PairedStudyRow } from "@/lib/analysis/astar-paired";
import type { PythonGame } from "@/lib/tournament/crosscheck";
import type { GameRecord } from "@/lib/tournament/play";

export interface StudyMeta {
  generatedBy: string;
  generatedAt?: string;
  node?: string;
  python?: string;
  cpu?: string;
  implementation: string;
  config: Record<string, unknown>;
  seconds?: number;
}

const DATA_DIR = path.join(process.cwd(), "src", "lib", "data");

function read<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(DATA_DIR, name), "utf8")) as T;
}

export const loadReferenceTournament = () =>
  read<{ meta: StudyMeta; games: GameRecord[] }>("reference-tournament.json");

export const loadAstarStudy = () =>
  read<{ meta: StudyMeta; rows: PairedStudyRow[] }>("astar-paired-study.json");

export const loadAlphaBetaStudy = () =>
  read<{ meta: StudyMeta; samples: PruningSample[] }>("alpha-beta-study.json");

export const loadPythonCrosscheck = () =>
  read<{ meta: StudyMeta; games: PythonGame[] }>("python-crosscheck.json");
