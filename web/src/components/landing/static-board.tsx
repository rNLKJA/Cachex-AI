import { HexBoard } from "@/components/board/hex-board";
import { Board } from "@/lib/cachex/board";
import type { Colour, Coord } from "@/lib/cachex/types";

export interface StaticPosition {
  n: number;
  tiles: { colour: Colour; coord: Coord }[];
}

const cellsOf = ({ n, tiles }: StaticPosition) => {
  const b = new Board(n);
  for (const { colour, coord } of tiles) b.set(coord[0], coord[1], colour);
  const out: (Colour | null)[] = [];
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) out.push(b.get(r, q));
  return out;
};

/** Non-interactive board used for illustrations. */
export function StaticBoard({
  position,
  label,
  winning,
  lastMove,
  highlights,
  className,
}: {
  position: StaticPosition;
  label: string;
  winning?: Coord[];
  lastMove?: Coord;
  highlights?: Coord[];
  className?: string;
}) {
  return (
    <HexBoard
      n={position.n}
      cells={cellsOf(position)}
      label={label}
      winning={winning ?? null}
      lastMove={lastMove ?? null}
      highlights={highlights}
      className={className}
    />
  );
}
