/**
 * Results tables shared by the precomputed reference tournament and the
 * in-browser runner. Pure presentational components (no hooks), so they render
 * on the server for the reference and on the client for live runs.
 */
import { EstimateCI, IntervalAxis, IntervalBar, niceTicks } from "@/components/stats/interval";
import { ScrollTable } from "@/components/stats/scroll-table";
import { AGENTS } from "@/lib/tournament/agents";
import type { TournamentSummary } from "@/lib/tournament/analyse";
import { formatNumber, formatPct, formatSigned } from "@/lib/stats/format";

const pctCI = (lo: number, hi: number) => `[${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]`;

export function Leaderboard({ summary, caption }: { summary: TournamentSummary; caption: string }) {
  const finite = summary.standings
    .flatMap((s) => [s.elo.lower, s.elo.upper])
    .filter(Number.isFinite);
  const lo = Math.min(0, ...finite);
  const hi = Math.max(100, ...finite);
  const pad = (hi - lo) * 0.06;
  const min = lo - pad;
  const max = hi + pad;
  return (
    <ScrollTable className="min-w-[640px]" caption={<>{caption}</>}>
      <thead className="text-muted-foreground text-left text-xs">
        <tr className="border-b">
          <th scope="col" className="py-2 pr-3 font-medium">
            Agent
          </th>
          <th scope="col" className="w-[28%] py-2 pr-3 font-medium">
            <span className="sr-only">Strength interval</span>
            <IntervalAxis
              min={min}
              max={max}
              ticks={niceTicks(lo, hi, 4)}
              format={(t) => String(t)}
            />
          </th>
          <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">
            {summary.anchor
              ? `Elo vs ${AGENTS[summary.anchor].short.toLowerCase()} (95% CI)`
              : "Elo vs field mean (95% CI)"}
          </th>
          <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">
            Win rate (95% CI)
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium whitespace-nowrap">
            W–D–L
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Illegal
          </th>
          <th scope="col" className="py-2 text-right font-medium whitespace-nowrap">
            ms / move (95% CI)
          </th>
        </tr>
      </thead>
      <tbody>
        {summary.standings.map((s) => {
          const anchor = s.id === summary.anchor;
          return (
            <tr key={s.id} className="border-border/50 border-b last:border-0">
              <th scope="row" className="min-w-44 py-2 pr-3 text-left font-normal">
                <span className="font-medium">{AGENTS[s.id].label}</span>
                <span className="text-muted-foreground block text-xs">{AGENTS[s.id].knob}</span>
              </th>
              <td className="py-2 pr-3">
                {anchor ? (
                  <span className="text-muted-foreground text-xs">reference (0)</span>
                ) : (
                  <IntervalBar
                    estimate={s.elo.estimate}
                    lower={s.elo.lower}
                    upper={s.elo.upper}
                    min={min}
                    max={max}
                    reference={0}
                    label={`${AGENTS[s.id].label}: Elo ${Math.round(s.elo.estimate)}, 95% CI ${Math.round(s.elo.lower)} to ${Math.round(s.elo.upper)}`}
                  />
                )}
              </td>
              <td className="py-2 pr-3">
                {anchor ? (
                  <span className="font-mono">0</span>
                ) : (
                  <EstimateCI
                    estimate={formatNumber(s.elo.estimate, 0)}
                    interval={`[${formatNumber(s.elo.lower, 0)}, ${formatNumber(s.elo.upper, 0)}]`}
                  />
                )}
              </td>
              <td className="py-2 pr-3">
                <EstimateCI
                  estimate={formatPct(s.winRate.p)}
                  interval={pctCI(s.winRate.lower, s.winRate.upper)}
                />
              </td>
              <td className="py-2 pr-3 text-right font-mono whitespace-nowrap tabular-nums">
                {s.wins}–{s.draws}–{s.losses}
              </td>
              <td className="py-2 pr-3 text-right font-mono tabular-nums">{s.illegalMoves}</td>
              <td className="py-2 text-right">
                <EstimateCI
                  estimate={formatNumber(s.moveMs.estimate, 2)}
                  interval={`[${formatNumber(s.moveMs.lower, 2)}, ${formatNumber(s.moveMs.upper, 2)}]`}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </ScrollTable>
  );
}

export function PairwiseTable({ summary }: { summary: TournamentSummary }) {
  const balanced = summary.pairs.every((p) => p.aAsRed.games === p.aAsBlue.games);
  const k = summary.agents.length;
  const missing = (k * (k - 1)) / 2 - summary.pairs.length;
  return (
    <ScrollTable
      className="min-w-[620px]"
      caption={
        <>
          Head to head. Win rate of the first-named agent; the vertical line marks 50%.{" "}
          {balanced
            ? "Each pairing played equal games as Red and as Blue."
            : "This run was stopped part-way, so some pairings played unequal games as Red and as Blue (see the last column); their win rates include the first-move effect."}
          {missing > 0 &&
            ` ${missing} pairing${missing === 1 ? " has" : "s have"} no games yet and ${missing === 1 ? "is" : "are"} not shown.`}
        </>
      }
    >
      <thead className="text-muted-foreground text-left text-xs">
        <tr className="border-b">
          <th scope="col" className="py-2 pr-3 font-medium">
            Pairing
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium whitespace-nowrap">
            W–L (D)
          </th>
          <th scope="col" className="w-[26%] py-2 pr-3 font-medium">
            <span className="sr-only">Win rate interval</span>
            <IntervalAxis min={0} max={1} ticks={[0, 0.5, 1]} format={(t) => `${t * 100}%`} />
          </th>
          <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">
            Win rate (95% CI)
          </th>
          <th scope="col" className="py-2 text-right font-medium whitespace-nowrap">
            As Red / as Blue
          </th>
        </tr>
      </thead>
      <tbody>
        {summary.pairs.map((p) => (
          <tr key={`${p.a}-${p.b}`} className="border-border/50 border-b last:border-0">
            <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">
              {AGENTS[p.a].short} <span className="text-muted-foreground">vs</span>{" "}
              {AGENTS[p.b].short}
            </th>
            <td className="py-2 pr-3 text-right font-mono whitespace-nowrap tabular-nums">
              {p.aWins}–{p.bWins}
              {p.draws > 0 && <span className="text-muted-foreground"> ({p.draws})</span>}
            </td>
            <td className="py-2 pr-3">
              <IntervalBar
                estimate={p.aWinRate.p}
                lower={p.aWinRate.lower}
                upper={p.aWinRate.upper}
                min={0}
                max={1}
                reference={0.5}
                label={`${AGENTS[p.a].short} beats ${AGENTS[p.b].short} in ${formatPct(p.aWinRate.p)} of ${p.games} games, 95% CI ${formatPct(p.aWinRate.lower)} to ${formatPct(p.aWinRate.upper)}`}
              />
            </td>
            <td className="py-2 pr-3">
              <EstimateCI
                estimate={formatPct(p.aWinRate.p)}
                interval={pctCI(p.aWinRate.lower, p.aWinRate.upper)}
              />
            </td>
            <td className="text-muted-foreground py-2 text-right font-mono text-xs whitespace-nowrap tabular-nums">
              {p.aAsRed.wins}/{p.aAsRed.games} · {p.aAsBlue.wins}/{p.aAsBlue.games}
            </td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  );
}

/**
 * Pairwise strength differences, each with a percentile interval from the same
 * bootstrap replicates as the leaderboard (so the correlation between the two
 * strengths is accounted for).
 */
export function EloDifferenceTable({ summary }: { summary: TournamentSummary }) {
  const diffs = summary.eloDifferences.filter((d) => Number.isFinite(d.estimate));
  if (diffs.length === 0) return null;
  const extent = Math.max(100, ...diffs.flatMap((d) => [Math.abs(d.lower), Math.abs(d.upper)]));
  const max = Math.ceil((extent * 1.06) / 50) * 50;
  return (
    <ScrollTable
      className="min-w-[520px]"
      label="Elo differences between agents"
      caption={
        <>
          Strength differences, first-named minus second, in Elo points. Each interval comes from
          the same {summary.bootstrap.reps} bootstrap refits as the leaderboard, so it is the right
          way to compare two agents (their separate intervals are correlated, so overlap is not a
          test). An interval that excludes 0 is a detectable difference.
        </>
      }
    >
      <thead className="text-muted-foreground text-left text-xs">
        <tr className="border-b">
          <th scope="col" className="py-2 pr-3 font-medium">
            Difference
          </th>
          <th scope="col" className="w-[36%] py-2 pr-3 font-medium">
            <span className="sr-only">Difference interval</span>
            <IntervalAxis
              min={-max}
              max={max}
              ticks={[-max, 0, max]}
              format={(t) => (t > 0 ? `+${t}` : t < 0 ? `−${-t}` : "0")}
            />
          </th>
          <th scope="col" className="py-2 font-medium whitespace-nowrap">
            Elo difference (95% CI)
          </th>
        </tr>
      </thead>
      <tbody>
        {diffs.map((d) => (
          <tr key={`${d.a}-${d.b}`} className="border-border/50 border-b last:border-0">
            <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">
              {AGENTS[d.a].short} <span className="text-muted-foreground">−</span>{" "}
              {AGENTS[d.b].short}
            </th>
            <td className="py-2 pr-3">
              <IntervalBar
                estimate={d.estimate}
                lower={d.lower}
                upper={d.upper}
                min={-max}
                max={max}
                reference={0}
                label={`${AGENTS[d.a].short} minus ${AGENTS[d.b].short}: ${Math.round(d.estimate)} Elo, 95% CI ${Math.round(d.lower)} to ${Math.round(d.upper)}`}
              />
            </td>
            <td className="py-2">
              <EstimateCI
                estimate={formatSigned(d.estimate, 0)}
                interval={`[${formatSigned(d.lower, 0)}, ${formatSigned(d.upper, 0)}]`}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  );
}

export function SummaryStats({ summary }: { summary: TournamentSummary }) {
  const c = summary.colour;
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <Stat
        label="Games"
        value={summary.games.toLocaleString("en-AU")}
        hint={`board sizes ${summary.sizes.join(", ")}`}
      />
      <Stat
        label="First-move (Red) win rate"
        value={formatPct(c.redWinRate.p)}
        hint={`95% CI ${formatPct(c.redWinRate.lower)} to ${formatPct(c.redWinRate.upper)}; ${c.draws} draw${c.draws === 1 ? "" : "s"}`}
      />
      <Stat
        label="Mean game length"
        value={`${formatNumber(summary.meanTurns, 1)} turns`}
        hint={`Bradley-Terry bootstrap: ${summary.bootstrap.reps} resamples, seed ${summary.bootstrap.seed}`}
      />
    </dl>
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
