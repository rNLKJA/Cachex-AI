"use client";

import { useState } from "react";

import { Segmented } from "@/components/play/primitives";
import type { TournamentSummary } from "@/lib/tournament/analyse";
import { Leaderboard, PairwiseTable, SummaryStats } from "./tournament-results";

/** Switches between precomputed summaries (all sizes, or one board size). */
export function ReferenceTournament({
  summaries,
  hardware,
}: {
  summaries: { key: string; label: string; summary: TournamentSummary }[];
  /** Where the move times were measured, e.g. "Apple M4, Node v26". */
  hardware: string;
}) {
  const [key, setKey] = useState(summaries[0].key);
  const current = summaries.find((s) => s.key === key) ?? summaries[0];
  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <Segmented
          label="Board size"
          value={key}
          onChange={setKey}
          options={summaries.map((s) => ({ value: s.key, label: s.label }))}
        />
      </div>
      <SummaryStats summary={current.summary} />
      <Leaderboard
        summary={current.summary}
        caption={`Bradley-Terry strengths on the Elo scale, fitted to every game (draws count half), with random fixed at 0 and percentile intervals from a bootstrap that resamples games within each pairing and board size. Win rates use Wilson intervals. Move times come from one run of the TypeScript port (${hardware}) and are only comparable within this table.`}
      />
      <PairwiseTable summary={current.summary} />
    </div>
  );
}
