/**
 * Paired Manhattan vs Euclidean results. Pure (no hooks): used for the
 * precomputed reference study on the server and for live runs on the client.
 */
import { EstimateCI, IntervalAxis, IntervalBar } from "@/components/stats/interval";
import { ScrollTable } from "@/components/stats/scroll-table";
import type { PairedStudySummary } from "@/lib/analysis/astar-paired";
import { formatNumber, formatPStatement, formatPct, formatSigned } from "@/lib/stats/format";

const pctCI = (lo: number, hi: number) => `[${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]`;

export function PairedStudySummaryView({ summary }: { summary: PairedStudySummary }) {
  const e = summary.expansions;
  const o = summary.optimality;
  const w = e.wilcoxon;
  const rows = [
    { label: "Manhattan", ci: o.manhattan, excess: o.manhattanExcess },
    { label: "Euclidean", ci: o.euclidean, excess: o.euclideanExcess },
    { label: "Both the same length", ci: o.agreement, excess: null },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <h3 className="font-semibold">Node expansions (paired, {summary.boards} boards)</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Stat
            label="Mean difference, Manhattan − Euclidean"
            value={formatSigned(e.meanDiff.estimate)}
            hint={`95% paired bootstrap CI [${formatSigned(e.meanDiff.lower)}, ${formatSigned(e.meanDiff.upper)}]; median ${formatSigned(e.medianDiff)}`}
          />
          <Stat
            label="Mean expansions per board"
            value={`${formatNumber(e.meanManhattan, 1)} vs ${formatNumber(e.meanEuclidean, 1)}`}
            hint="Manhattan vs Euclidean, the notebook's counter"
          />
          <Stat
            label="Wilcoxon signed-rank (two-sided)"
            value={formatPStatement(w.pValue)}
            hint={`n = ${w.n} non-zero pairs (${w.zeros} ties dropped), W = ${formatNumber(w.statistic, 1)}${w.z !== null ? `, z = ${formatNumber(w.z, 2)}` : ""}`}
          />
          <Stat
            label="Effect size"
            value={`r = ${formatSigned(w.rankBiserial, 2)}`}
            hint={`matched-pairs rank-biserial; Cohen's d_z = ${formatSigned(e.dz, 2)}`}
          />
        </dl>
        <p className="text-muted-foreground text-xs">
          Manhattan expanded fewer nodes on {e.manhattanFewer} boards, Euclidean on{" "}
          {e.euclideanFewer}, with {e.ties} ties. Negative differences favour Manhattan.
        </p>
      </div>

      <div className="min-w-0 space-y-3">
        <h3 className="font-semibold">
          Did A* find a shortest path? ({summary.boardsWithPath} boards with a path)
        </h3>
        <ScrollTable
          className="min-w-[420px]"
          caption={
            <>
              Compared with a breadth-first search on the same board. Wilson 95% intervals for each
              rate on its own.
            </>
          }
        >
          <thead className="text-muted-foreground text-left text-xs">
            <tr className="border-b">
              <th scope="col" className="py-2 pr-3 font-medium">
                Heuristic
              </th>
              <th scope="col" className="w-[34%] py-2 pr-3 font-medium">
                <span className="sr-only">Interval</span>
                <IntervalAxis min={0} max={1} ticks={[0, 0.5, 1]} format={(t) => `${t * 100}%`} />
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Rate (95% CI)
              </th>
              <th scope="col" className="py-2 text-right font-medium whitespace-nowrap">
                Extra cells
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-border/50 border-b last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  {r.label}
                  <span className="text-muted-foreground block text-xs">
                    {r.excess === null ? "agreement rate" : "shortest path found"}
                  </span>
                </th>
                <td className="py-2 pr-3">
                  <IntervalBar
                    estimate={r.ci.p}
                    lower={r.ci.lower}
                    upper={r.ci.upper}
                    min={0}
                    max={1}
                    label={`${r.label}: ${r.ci.successes} of ${r.ci.n}, 95% CI ${formatPct(r.ci.lower)} to ${formatPct(r.ci.upper)}`}
                  />
                </td>
                <td className="py-2 pr-3">
                  <EstimateCI
                    estimate={formatPct(r.ci.p)}
                    interval={pctCI(r.ci.lower, r.ci.upper)}
                  />
                </td>
                <td className="py-2 text-right font-mono text-xs tabular-nums">
                  {r.excess === null ? "" : `+${formatNumber(r.excess, 2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Stat
            label="Paired difference, Manhattan − Euclidean"
            value={`${formatSigned(o.difference.estimate * 100, 1)} pp`}
            hint={`95% paired bootstrap CI [${formatSigned(o.difference.lower * 100, 1)}, ${formatSigned(o.difference.upper * 100, 1)}] pp; resamples boards, ${o.difference.reps} reps, seed ${o.difference.seed}`}
          />
          <Stat
            label="Exact McNemar test (two-sided)"
            value={formatPStatement(o.mcnemar.pValue)}
            hint={`${o.mcnemar.discordant} discordant boards: optimal for Manhattan only on ${o.mcnemar.b}, Euclidean only on ${o.mcnemar.c}`}
          />
        </dl>
        <p className="text-muted-foreground text-xs">
          The two rates come from the same boards, so the paired difference and McNemar&apos;s test
          (which uses only the boards where the heuristics disagree) are the comparison; the
          separate intervals above describe each heuristic on its own. Extra cells: mean path length
          beyond the shortest, over boards with a path (largest seen: {o.maxExcess}). Neither
          heuristic is admissible on this grid: both overestimate the true distance for{" "}
          {formatPct(summary.overestimation.manhattan)} of start/goal pairs on an empty{" "}
          {summary.overestimation.dimension} × {summary.overestimation.dimension} board.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-background/50 rounded-xl border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums">{value}</dd>
      {hint && <dd className="text-muted-foreground text-xs">{hint}</dd>}
    </div>
  );
}
