/**
 * Precompute the reference studies shown on /tournament and /astar, using the
 * parity-tested TypeScript port (the original Python is too slow for depth-3
 * search at this scale; scripts/crosscheck_tournament.py re-runs the feasible
 * subset with the original code).
 *
 *   cd web && pnpm gen:reference            # all three studies
 *   cd web && pnpm gen:reference tournament # just one
 *
 * Output (deterministic for the seeds below, apart from wall-clock timings):
 *   src/lib/data/reference-tournament.json
 *   src/lib/data/astar-paired-study.json
 *   src/lib/data/alpha-beta-study.json
 */
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { measurePruning, samplePositions, summarisePruning } from "../src/lib/analysis/alpha-beta";
import { runPairedStudy, summarisePairedStudy } from "../src/lib/analysis/astar-paired";
import { AGENT_IDS } from "../src/lib/tournament/agents";
import { summariseTournament } from "../src/lib/tournament/analyse";
import { playTournamentGame } from "../src/lib/tournament/play";
import { buildSchedule } from "../src/lib/tournament/schedule";
import {
  ALPHA_BETA_CONFIG,
  ASTAR_STUDY_CONFIG,
  REFERENCE_TOURNAMENT_CONFIG,
} from "../src/lib/data/reference-config";

const DATA = path.join(import.meta.dirname, "..", "src", "lib", "data");
const only = process.argv[2];

const meta = () => ({
  generatedBy: "web/scripts/generate-reference-studies.ts",
  generatedAt: new Date().toISOString().slice(0, 10),
  node: process.version,
  cpu: os.cpus()[0]?.model ?? "unknown",
  implementation: "TypeScript port (parity-tested against the original Python)",
});

function write(name: string, payload: unknown) {
  const file = path.join(DATA, name);
  writeFileSync(file, `${JSON.stringify(payload)}\n`);
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

if (!only || only === "tournament") {
  const config = REFERENCE_TOURNAMENT_CONFIG;
  const schedule = buildSchedule({ ...config, agents: [...AGENT_IDS] });
  console.log(`tournament: ${schedule.length} games`);
  const started = Date.now();
  const games = schedule.map((spec, i) => {
    const g = playTournamentGame(spec);
    if ((i + 1) % 100 === 0)
      console.log(
        `  ${i + 1}/${schedule.length} (${((Date.now() - started) / 1000).toFixed(0)} s)`,
      );
    return {
      ...g,
      red: {
        ...g.red,
        totalMs: Number(g.red.totalMs.toFixed(3)),
        maxMs: Number(g.red.maxMs.toFixed(3)),
      },
      blue: {
        ...g.blue,
        totalMs: Number(g.blue.totalMs.toFixed(3)),
        maxMs: Number(g.blue.maxMs.toFixed(3)),
      },
    };
  });
  write("reference-tournament.json", { meta: { ...meta(), config }, games });
  const s = summariseTournament(games, { reps: 1000, seed: config.seed });
  for (const a of s.standings) {
    console.log(`  deep searches ${a.id}: ${(a.deepSearchShare * 100).toFixed(1)}%`);
    console.log(
      `${a.id.padEnd(16)} elo ${a.elo.estimate.toFixed(0)} [${a.elo.lower.toFixed(0)}, ${a.elo.upper.toFixed(0)}]  win ${(a.winRate.p * 100).toFixed(1)}% [${(a.winRate.lower * 100).toFixed(1)}, ${(a.winRate.upper * 100).toFixed(1)}]  ${a.moveMs.estimate.toFixed(2)} ms/move`,
    );
  }
  for (const p of s.pairs) {
    console.log(
      `${p.a} vs ${p.b}: ${p.aWins}-${p.bWins}-${p.draws} (${(p.aWinRate.p * 100).toFixed(1)}% [${(p.aWinRate.lower * 100).toFixed(1)}, ${(p.aWinRate.upper * 100).toFixed(1)}])`,
    );
  }
  console.log(`red wins ${s.colour.redWins}/${s.colour.games}`);
}

if (!only || only === "astar") {
  const rows = runPairedStudy(ASTAR_STUDY_CONFIG);
  write("astar-paired-study.json", { meta: { ...meta(), config: ASTAR_STUDY_CONFIG }, rows });
  const s = summarisePairedStudy(rows, { seed: ASTAR_STUDY_CONFIG.seed });
  console.log(JSON.stringify(s, null, 2));
}

if (!only || only === "alphabeta") {
  const positions = samplePositions(ALPHA_BETA_CONFIG);
  const samples = positions.flatMap((p) =>
    ALPHA_BETA_CONFIG.depths.flatMap((depth) =>
      (["shuffled", "canonical"] as const).map((order) => measurePruning(p, depth, order)),
    ),
  );
  write("alpha-beta-study.json", { meta: { ...meta(), config: ALPHA_BETA_CONFIG }, samples });
  for (const g of summarisePruning(samples, { seed: ALPHA_BETA_CONFIG.seed })) {
    console.log(
      `n=${g.n} d=${g.depth} ${g.order}: ratio ${g.meanRatio.estimate.toFixed(3)} [${g.meanRatio.lower.toFixed(3)}, ${g.meanRatio.upper.toFixed(3)}] full ${g.meanFull.toFixed(0)} pruned ${g.meanPruned.toFixed(0)} match ${g.valueMatches}/${g.positions} | textbook ${g.textbookRatio.estimate.toFixed(3)} [${g.textbookRatio.lower.toFixed(3)}, ${g.textbookRatio.upper.toFixed(3)}] nodes ${g.meanTextbook.toFixed(0)} match ${g.textbookValueMatches}`,
    );
  }
}
