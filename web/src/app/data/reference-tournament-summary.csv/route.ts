import { loadReferenceTournament } from "@/lib/data/load";
import { REFERENCE_TOURNAMENT_CONFIG } from "@/lib/data/reference-config";
import { summariseTournament, summaryCsv } from "@/lib/tournament/analyse";

export const dynamic = "force-static";

export function GET() {
  const summary = summariseTournament(loadReferenceTournament().games, {
    reps: 1000,
    seed: REFERENCE_TOURNAMENT_CONFIG.seed,
  });
  return new Response(summaryCsv(summary), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
}
