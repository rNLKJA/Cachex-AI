import { ArrowRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Finding, PageHeader, Section } from "@/components/layout/page-header";
import { EstimateCI, IntervalAxis, IntervalBar } from "@/components/stats/interval";
import { AlphaBetaTable } from "@/components/tournament/alpha-beta-table";
import { ReferenceTournament } from "@/components/tournament/reference-tournament";
import { TournamentRunner } from "@/components/tournament/tournament-runner";
import { Button } from "@/components/ui/button";
import { ScrollTable } from "@/components/stats/scroll-table";
import { summarisePruning } from "@/lib/analysis/alpha-beta";
import benchmark from "@/lib/data/agent-benchmark.json";
import { loadAlphaBetaStudy, loadPythonCrosscheck, loadReferenceTournament } from "@/lib/data/load";
import { ALPHA_BETA_CONFIG, REFERENCE_TOURNAMENT_CONFIG } from "@/lib/data/reference-config";
import { formatPct, formatSigned } from "@/lib/stats/format";
import { wilson } from "@/lib/stats/proportion";
import { AGENTS } from "@/lib/tournament/agents";
import { eloDifference, summariseTournament } from "@/lib/tournament/analyse";
import { compareImplementations } from "@/lib/tournament/crosscheck";

export const metadata: Metadata = {
  title: "Tournament",
  description:
    "A seeded, colour-swapped round robin between the original minimax agent and controlled variants, with Wilson and bootstrap intervals, Bradley-Terry strengths and an alpha-beta efficiency study.",
};

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];

const pctCI = (lo: number, hi: number) => `[${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]`;

export default function TournamentPage() {
  // Original benchmark (Python), restated with intervals.
  const totals = benchmark.results.reduce(
    (a, r) => ({ wins: a.wins + r.wins, games: a.games + r.games }),
    { wins: 0, games: 0 },
  );
  const overall = wilson(totals.wins, totals.games);
  const bySize = [...new Set(benchmark.results.map((r) => r.n))].map((n) => {
    const rows = benchmark.results.filter((r) => r.n === n);
    const wins = rows.reduce((s, r) => s + r.wins, 0);
    const games = rows.reduce((s, r) => s + r.games, 0);
    return { n, ci: wilson(wins, games) };
  });

  // Reference tournament (TypeScript port).
  const ref = loadReferenceTournament();
  const cfg = REFERENCE_TOURNAMENT_CONFIG;
  const summaries = [
    {
      key: "all",
      label: "All sizes",
      summary: summariseTournament(ref.games, { reps: 1000, seed: cfg.seed }),
    },
    ...cfg.sizes.map((n) => ({
      key: String(n),
      label: `${n} × ${n}`,
      summary: summariseTournament(ref.games, { reps: 1000, seed: cfg.seed, sizes: [n] }),
    })),
  ];
  const all = summaries[0].summary;
  const pair = (a: string, b: string) => all.pairs.find((p) => p.a === a && p.b === b)!;
  const dynVsGreedy = pair("minimax-dynamic", "greedy");
  const dynVsD3 = pair("minimax-dynamic", "minimax-d3");
  const dynVsRandom = pair("minimax-dynamic", "random");
  const standing = (id: string) => all.standings.find((s) => s.id === id)!;
  const dyn = standing("minimax-dynamic");
  const d3 = standing("minimax-d3");
  // Strength comparisons use differences from the same bootstrap refits, not overlap.
  const dynMinusGreedy = eloDifference(all, "minimax-dynamic", "greedy")!;
  const d3MinusDyn = eloDifference(all, "minimax-d3", "minimax-dynamic")!;
  const elo = (x: number) => formatSigned(x, 0);
  const deepSearches = ref.games.reduce(
    (acc, g) => {
      for (const s of [g.red, g.blue]) {
        if (s.agent !== "minimax-dynamic") continue;
        acc.searches += s.searches;
        acc.deep += s.deepSearches;
      }
      return acc;
    },
    { searches: 0, deep: 0 },
  );
  const hardware = `${ref.meta.cpu ?? "unknown CPU"}, Node ${ref.meta.node ?? "?"}`;

  // Cross-check against the original Python.
  const py = loadPythonCrosscheck();
  const cross = compareImplementations(ref.games, py.games);

  // Alpha-beta efficiency.
  const ab = loadAlphaBetaStudy();
  const groups = summarisePruning(ab.samples, { seed: ALPHA_BETA_CONFIG.seed });
  const shuffled = groups.filter((g) => g.order === "shuffled");
  const canonical = groups.filter((g) => g.order === "canonical");
  const worst = shuffled.reduce((a, b) => (b.meanRatio.estimate < a.meanRatio.estimate ? b : a));
  const deepest = shuffled.find((g) => g.n === 6 && g.depth === 3)!;
  const allMatch = ab.samples.every((s) => s.valueMatches && s.textbookValueMatches);

  return (
    <div className="table-felt">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:px-6 lg:py-10">
        <PageHeader eyebrow="Evaluation" title="How strong is the agent, really?">
          <p>
            A seeded round robin between the original{" "}
            <code className="font-mono text-sm">_4399</code> agent and variants that each change
            exactly one knob, with colour-swapped pairs to cancel the first-move advantage. Every
            number comes with its sample size and a 95% interval.
          </p>
          <p className="text-sm">
            Jump to:{" "}
            <a className="underline underline-offset-4" href="#benchmark">
              original benchmark
            </a>{" "}
            ·{" "}
            <a className="underline underline-offset-4" href="#reference">
              reference round robin
            </a>{" "}
            ·{" "}
            <a className="underline underline-offset-4" href="#crosscheck">
              Python cross-check
            </a>{" "}
            ·{" "}
            <a className="underline underline-offset-4" href="#run">
              run your own
            </a>{" "}
            ·{" "}
            <a className="underline underline-offset-4" href="#alpha-beta">
              alpha-beta efficiency
            </a>
          </p>
        </PageHeader>

        <Section
          id="benchmark"
          eyebrow="Restated, not changed"
          title="The original benchmark, with its uncertainty"
          intro={
            <p>
              The headline result from the original Python ({benchmark.meta.generatedBy}, Python{" "}
              {benchmark.meta.python}): the agent beat the subject&apos;s random agent in{" "}
              {totals.wins} of {totals.games} games on boards 4 to 7, 20 seeded games per size and
              colour. The count is unchanged; the interval is new.
            </p>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div className="bg-background/50 flex flex-col rounded-2xl border p-5">
              <div className="font-display text-4xl font-semibold tracking-tight">
                {formatPct(overall.p)}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {totals.wins} of {totals.games} games won against the random agent
              </p>
              <div className="mt-auto pt-5">
                <IntervalBar
                  estimate={overall.p}
                  lower={overall.lower}
                  upper={overall.upper}
                  min={0.5}
                  max={1}
                  label={`All sizes: ${totals.wins} of ${totals.games}, 95% CI ${formatPct(overall.lower)} to ${formatPct(overall.upper)}`}
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Wilson 95% CI{" "}
                  <span className="text-foreground font-mono">
                    {formatPct(overall.lower)} to {formatPct(overall.upper)}
                  </span>
                </p>
              </div>
            </div>
            <ScrollTable
              className="min-w-[420px]"
              caption={
                <>
                  By board size (both colours pooled, 40 games each). Small samples give wide
                  intervals.
                </>
              }
            >
              <thead className="text-muted-foreground text-left text-xs">
                <tr className="border-b">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Board
                  </th>
                  <th scope="col" className="w-[40%] py-2 pr-3 font-medium">
                    <span className="sr-only">Interval</span>
                    <IntervalAxis
                      min={0.5}
                      max={1}
                      ticks={[0.5, 0.75, 1]}
                      format={(t) => `${t * 100}%`}
                    />
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Win rate (95% CI)
                  </th>
                </tr>
              </thead>
              <tbody>
                {bySize.map(({ n, ci }) => (
                  <tr key={n} className="border-border/50 border-b last:border-0">
                    <th
                      scope="row"
                      className="py-2 pr-3 text-left font-mono font-normal whitespace-nowrap"
                    >
                      {n} × {n}
                    </th>
                    <td className="py-2 pr-3">
                      <IntervalBar
                        estimate={ci.p}
                        lower={ci.lower}
                        upper={ci.upper}
                        min={0.5}
                        max={1}
                        label={`${n} by ${n}: ${ci.successes} of ${ci.n}, 95% CI ${formatPct(ci.lower)} to ${formatPct(ci.upper)}`}
                      />
                    </td>
                    <td className="py-2">
                      <EstimateCI
                        estimate={`${ci.successes}/${ci.n} · ${formatPct(ci.p)}`}
                        interval={pctCI(ci.lower, ci.upper)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          </div>
        </Section>

        <Section
          id="reference"
          eyebrow="Reference round robin"
          title={`${ref.games.length.toLocaleString("en-AU")} games, ${WORDS[cfg.agents.length]} agents, ${WORDS[cfg.sizes.length]} board sizes`}
          intro={
            <>
              <p>
                Every pairing played {cfg.rounds * 2} games per board size ({cfg.rounds} seeds, each
                played twice with colours swapped) on{" "}
                {cfg.sizes.map((n) => `${n}\u00a0×\u00a0${n}`).join(", ")}. Tournament seed{" "}
                {cfg.seed}. Played by the TypeScript port, which reproduces the original Python move
                for move in deterministic mode; the original is too slow for depth-3 search at this
                scale, so a feasible subset was re-run in Python below.
              </p>
            </>
          }
        >
          <ul className="mb-6 grid gap-3 md:grid-cols-2">
            <Finding>
              <strong>Depth matters; dynamic depth barely runs.</strong> Fixed depth 3 beat the
              original in {dynVsD3.bWins} of {dynVsD3.games} games (
              {formatPct(1 - dynVsD3.aWinRate.p)}, 95% CI {formatPct(1 - dynVsD3.aWinRate.upper)} to{" "}
              {formatPct(1 - dynVsD3.aWinRate.lower)}). The original searched deeper than one ply on
              only {deepSearches.deep} of {deepSearches.searches.toLocaleString("en-AU")} searched
              moves ({formatPct(deepSearches.deep / deepSearches.searches)}): its thresholds only
              deepen once fewer than 15% of cells are empty, and most games end before that.
            </Finding>
            <Finding>
              <strong>No detectable difference from greedy one-ply.</strong> Head to head the
              original won {dynVsGreedy.aWins} and lost {dynVsGreedy.bWins} (
              {formatPct(dynVsGreedy.aWinRate.p)}, 95% CI {formatPct(dynVsGreedy.aWinRate.lower)} to{" "}
              {formatPct(dynVsGreedy.aWinRate.upper)}), and its strength minus greedy&apos;s is{" "}
              {elo(dynMinusGreedy.estimate)} Elo (95% CI {elo(dynMinusGreedy.lower)} to{" "}
              {elo(dynMinusGreedy.upper)}). The interval still allows the original to win up to
              about {Math.round((dynVsGreedy.aWinRate.upper - 0.5) * 100)} points more or{" "}
              {Math.round((0.5 - dynVsGreedy.aWinRate.lower) * 100)} points less than half its games
              against greedy, so only larger differences are ruled out; the opening book and the
              late deepening add no detectable strength.
            </Finding>
            <Finding>
              <strong>Against random it reproduces the original benchmark.</strong>{" "}
              {dynVsRandom.aWins}/{dynVsRandom.games} wins ({formatPct(dynVsRandom.aWinRate.p)}, 95%
              CI {formatPct(dynVsRandom.aWinRate.lower)} to {formatPct(dynVsRandom.aWinRate.upper)})
              on boards 4 to 6, consistent with the 90% the Python run recorded on boards 4 to 7.
            </Finding>
            <Finding>
              <strong>Strength costs time.</strong> Depth 3 is {Math.round(d3MinusDyn.estimate)} Elo
              above the original (95% CI {Math.round(d3MinusDyn.lower)} to{" "}
              {Math.round(d3MinusDyn.upper)}) but spends about{" "}
              {Math.round(d3.moveMs.estimate / dyn.moveMs.estimate)}× as long per move, partly
              because of the pruning bug described{" "}
              <a href="#alpha-beta" className="underline underline-offset-4">
                below
              </a>
              . No first-move advantage was detectable: Red won {formatPct(all.colour.redWinRate.p)}{" "}
              (95% CI {formatPct(all.colour.redWinRate.lower)} to{" "}
              {formatPct(all.colour.redWinRate.upper)}).
            </Finding>
          </ul>
          <ReferenceTournament summaries={summaries} hardware={hardware} />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/data/reference-tournament-games.csv" download>
                <Download /> All {ref.games.length.toLocaleString("en-AU")} games (CSV)
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/data/reference-tournament-summary.csv" download>
                <Download /> Summary (CSV)
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/methods/agent-card">
                Agent card <ArrowRight />
              </Link>
            </Button>
          </div>
        </Section>

        <Section
          id="crosscheck"
          eyebrow="Validation"
          title="Cross-check against the original Python"
          intro={
            <p>
              <code className="font-mono text-sm">scripts/crosscheck_tournament.py</code> rebuilt
              the same variants from the unchanged Python (patching only{" "}
              <code className="font-mono text-sm">dynamic_depth_allocation</code> and the
              opening-book flag) and replayed the pairings that are feasible in Python on boards{" "}
              {cross[0]?.sizes.join(" and ")}, with the same colour-swapped protocol. Random streams
              differ between the languages, so games differ; the question is whether win rates
              agree. With {cross[0]?.python.n} games per pairing this can only rule out large
              discrepancies.
            </p>
          }
        >
          <ScrollTable
            className="min-w-[620px]"
            caption={
              <>
                Win rate of the first-named agent. Difference = Python − TypeScript, with
                Newcombe&apos;s 95% interval; an interval that contains 0 is consistent with no
                difference.
              </>
            }
          >
            <thead className="text-muted-foreground text-left text-xs">
              <tr className="border-b">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Pairing
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Original Python
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  TypeScript port
                </th>
                <th scope="col" className="w-[22%] py-2 pr-3 font-medium">
                  <span className="sr-only">Difference interval</span>
                  <IntervalAxis
                    min={-0.4}
                    max={0.4}
                    ticks={[-0.4, 0, 0.4]}
                    format={(t) => `${t > 0 ? "+" : ""}${Math.round(t * 100)}`}
                  />
                </th>
                <th scope="col" className="py-2 font-medium">
                  Difference (pp)
                </th>
              </tr>
            </thead>
            <tbody>
              {cross.map((r) => (
                <tr key={`${r.a}-${r.b}`} className="border-border/50 border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">
                    {AGENTS[r.a].short} <span className="text-muted-foreground">vs</span>{" "}
                    {AGENTS[r.b].short}
                  </th>
                  <td className="py-2 pr-3">
                    <EstimateCI
                      estimate={`${r.python.successes}/${r.python.n}`}
                      interval={pctCI(r.python.lower, r.python.upper)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <EstimateCI
                      estimate={`${r.typescript.successes}/${r.typescript.n}`}
                      interval={pctCI(r.typescript.lower, r.typescript.upper)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <IntervalBar
                      estimate={r.difference.estimate}
                      lower={r.difference.lower}
                      upper={r.difference.upper}
                      min={-0.4}
                      max={0.4}
                      reference={0}
                      label={`Difference ${formatSigned(r.difference.estimate * 100)} points, 95% CI ${formatSigned(r.difference.lower * 100)} to ${formatSigned(r.difference.upper * 100)}`}
                    />
                  </td>
                  <td className="py-2">
                    <EstimateCI
                      estimate={formatSigned(r.difference.estimate * 100)}
                      interval={`[${formatSigned(r.difference.lower * 100)}, ${formatSigned(r.difference.upper * 100)}]`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        </Section>

        <Section
          id="run"
          eyebrow="Run your own"
          title="A round robin in your browser"
          intro={
            <p>
              Same harness, same statistics, run on your machine in Web Workers. Pick a seed to make
              the run reproducible, then export the games and the summary as CSV.
            </p>
          }
        >
          <TournamentRunner />
        </Section>

        <Section
          id="alpha-beta"
          eyebrow="Search efficiency"
          title="Alpha-beta pruning saves almost nothing, and here is why"
          intro={
            <>
              <p>
                {ab.samples.length / (ALPHA_BETA_CONFIG.depths.length * 2)} mid-game positions (
                {ALPHA_BETA_CONFIG.perSize} per board size, from seeded greedy-vs-random games, seed{" "}
                {ALPHA_BETA_CONFIG.seed}) were searched three ways at the same depth and move order:
                plain minimax (no pruning), the original alpha-beta as submitted, and a textbook
                alpha-beta. The share of the full tree each one visits is the pruning ratio; lower
                is better.
              </p>
              <p>
                The original prunes very little (at best it still visits{" "}
                {formatPct(worst.meanRatio.estimate)} of the tree). The cause is one line in{" "}
                <code className="font-mono text-sm">minimax.py</code>: the minimising branch updates
                beta with{" "}
                <code className="font-mono text-sm">if beta &lt;= min_score: beta = min_score</code>
                , which can only raise beta, so the window never narrows there. The answer is still
                right ({allMatch ? "all" : "not all"} {ab.samples.length} searches returned the same
                root value as plain minimax), just slow. With{" "}
                <code className="font-mono text-sm">beta = min(beta, min_score)</code> the same
                search on 6 × 6 at depth 3 would visit {formatPct(deepest.textbookRatio.estimate)}{" "}
                of the tree instead of {formatPct(deepest.meanRatio.estimate)}. The agent on this
                site is left as submitted.
              </p>
            </>
          }
        >
          <AlphaBetaTable
            groups={shuffled}
            caption="The agent's own shuffled move order. Upper mark: original; lower, fainter mark: textbook alpha-beta. Intervals: percentile bootstrap over positions (2,000 resamples). Last column: positions where each pruned search returned the same root value as plain minimax."
          />
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Canonical (r, q) move order
            </summary>
            <div className="mt-3">
              <AlphaBetaTable
                groups={canonical}
                caption="Same positions, moves searched in sorted (r, q) order instead of shuffled."
              />
            </div>
          </details>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/data/alpha-beta-study.csv" download>
                <Download /> Per-position results (CSV)
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/methods/decisions/DR-002-dynamic-depth-allocation">
                DR-002: dynamic depth allocation <ArrowRight />
              </Link>
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
