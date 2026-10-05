import { pairedStudyCsvRows } from "@/lib/analysis/astar-paired";
import { toCsv } from "@/lib/csv";
import { loadAstarStudy } from "@/lib/data/load";

export const dynamic = "force-static";

export function GET() {
  return new Response(toCsv(pairedStudyCsvRows(loadAstarStudy().rows)), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
}
