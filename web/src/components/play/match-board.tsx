"use client";

import { HexBoard } from "@/components/board/hex-board";
import type { MatchView } from "@/lib/cachex/match";
import type { Colour } from "@/lib/cachex/types";

export function MatchBoard({
  n,
  view,
  moveCount,
  humanColour,
  onPlace,
  showCoords,
}: {
  n: number;
  view: MatchView;
  moveCount: number;
  /** Colour of the human to move, or null when no human can act. */
  humanColour: Colour | null;
  onPlace?: (r: number, q: number) => void;
  showCoords?: boolean;
}) {
  const { game } = view;
  const result = game.result;
  const label = result
    ? result.kind === "win"
      ? `Cachex board, ${n} by ${n}. ${result.winner} has won.`
      : `Cachex board, ${n} by ${n}. The game is drawn.`
    : `Cachex board, ${n} by ${n}. ${game.turnPlayer()} to move. Use arrow keys to move between cells and Enter to place.`;

  return (
    <HexBoard
      n={n}
      cells={view.cells}
      label={label}
      onCellActivate={humanColour && onPlace ? onPlace : undefined}
      isCellInteractive={(r, q) => humanColour !== null && game.isLegal(["PLACE", r, q])}
      describeCell={(r, q) =>
        game.isForbiddenOpening(r, q) ? "centre is not allowed on the first move" : undefined
      }
      previewColour={humanColour}
      lastMove={view.lastMove}
      captured={view.captured}
      moveKey={moveCount}
      winning={view.winning}
      showCoords={showCoords}
      className="drop-shadow-[0_20px_40px_rgb(0_0_0/0.25)]"
    />
  );
}
