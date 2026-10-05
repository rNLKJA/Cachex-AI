import { toCsv } from "@/lib/csv";
import { loadAlphaBetaStudy } from "@/lib/data/load";

export const dynamic = "force-static";

export function GET() {
  const rows = loadAlphaBetaStudy().samples.map((s) => ({
    board_n: s.n,
    depth: s.depth,
    move_order: s.order,
    empty_cells: s.empty,
    nodes_full_minimax: s.nodesFull,
    nodes_original_alphabeta: s.nodesPruned,
    ratio_original: Number(s.ratio.toFixed(6)),
    original_value_matches: s.valueMatches,
    nodes_textbook_alphabeta: s.nodesTextbook,
    ratio_textbook: Number(s.ratioTextbook.toFixed(6)),
    textbook_value_matches: s.textbookValueMatches,
  }));
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
