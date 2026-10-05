import { loadReferenceTournament } from "@/lib/data/load";
import { gamesCsv } from "@/lib/tournament/analyse";

export const dynamic = "force-static";

export function GET() {
  return new Response(gamesCsv(loadReferenceTournament().games), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
}
