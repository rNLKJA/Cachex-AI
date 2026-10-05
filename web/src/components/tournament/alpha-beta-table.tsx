/**
 * Alpha-beta efficiency table: share of the full minimax tree each search
 * visits, per board size and depth, with bootstrap intervals over positions.
 */
import { EstimateCI, IntervalAxis, IntervalBar } from "@/components/stats/interval";
import { ScrollTable } from "@/components/stats/scroll-table";
import type { PruningGroup } from "@/lib/analysis/alpha-beta";
import { formatNumber, formatPct } from "@/lib/stats/format";

const ci = (lo: number, hi: number) => `[${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]`;

export function AlphaBetaTable({ groups, caption }: { groups: PruningGroup[]; caption: string }) {
  return (
    <ScrollTable className="min-w-[720px]" caption={<>{caption}</>}>
      <thead className="text-muted-foreground text-left text-xs">
        <tr className="border-b">
          <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">
            Board · depth
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium whitespace-nowrap">
            Full tree (nodes)
          </th>
          <th scope="col" className="w-[22%] py-2 pr-3 font-medium">
            <span className="sr-only">Share of tree visited</span>
            <IntervalAxis min={0} max={1} ticks={[0, 0.5, 1]} format={(t) => `${t * 100}%`} />
          </th>
          <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">
            Original: share visited
          </th>
          <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">
            Textbook: share visited
          </th>
          <th scope="col" className="py-2 text-right font-medium whitespace-nowrap">
            Same value
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr
            key={`${g.n}-${g.depth}-${g.order}`}
            className="border-border/50 border-b last:border-0"
          >
            <th scope="row" className="py-2 pr-3 text-left font-mono font-normal whitespace-nowrap">
              {g.n}×{g.n} · d{g.depth}
              <span className="text-muted-foreground block font-sans text-xs">
                {g.positions} positions
              </span>
            </th>
            <td className="py-2 pr-3 text-right font-mono tabular-nums">
              {formatNumber(g.meanFull, 0)}
            </td>
            <td className="space-y-1 py-2 pr-3">
              <IntervalBar
                estimate={g.meanRatio.estimate}
                lower={g.meanRatio.lower}
                upper={g.meanRatio.upper}
                min={0}
                max={1}
                label={`Original alpha-beta visits ${formatPct(g.meanRatio.estimate)} of the full tree (95% CI ${formatPct(g.meanRatio.lower)} to ${formatPct(g.meanRatio.upper)})`}
              />
              <IntervalBar
                estimate={g.textbookRatio.estimate}
                lower={g.textbookRatio.lower}
                upper={g.textbookRatio.upper}
                min={0}
                max={1}
                className="opacity-60"
                label={`Textbook alpha-beta visits ${formatPct(g.textbookRatio.estimate)} of the full tree (95% CI ${formatPct(g.textbookRatio.lower)} to ${formatPct(g.textbookRatio.upper)})`}
              />
            </td>
            <td className="py-2 pr-3">
              <EstimateCI
                estimate={formatPct(g.meanRatio.estimate)}
                interval={ci(g.meanRatio.lower, g.meanRatio.upper)}
              />
              <span className="text-muted-foreground block font-mono text-xs">
                {formatNumber(g.meanPruned, 0)} nodes
              </span>
            </td>
            <td className="py-2 pr-3">
              <EstimateCI
                estimate={formatPct(g.textbookRatio.estimate)}
                interval={ci(g.textbookRatio.lower, g.textbookRatio.upper)}
              />
              <span className="text-muted-foreground block font-mono text-xs">
                {formatNumber(g.meanTextbook, 0)} nodes
              </span>
            </td>
            <td className="py-2 text-right font-mono text-xs tabular-nums">
              {g.valueMatches}/{g.positions} · {g.textbookValueMatches}/{g.positions}
            </td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  );
}
