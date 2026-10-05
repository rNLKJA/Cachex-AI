/**
 * Port of `Board_4399` (coursework/Project Part B/code/utility/board.py):
 * the agent's own board, extending the referee board with the last action,
 * last player, winner and a turn counter.
 */
import { Board } from "@/lib/cachex/board";
import { type Action, type Colour, type Coord, isSteal } from "@/lib/cachex/types";

export class AgentBoard extends Board {
  lastAction: Action | null = null;
  lastPlayer: Colour = "blue";
  winner: Colour | null = null;
  /** 1-based number of the turn about to be played. */
  turn = 1;

  constructor(n: number, data?: Uint8Array) {
    super(n, data);
  }

  static fromActions(n: number, actions: readonly Action[]): AgentBoard {
    const board = new AgentBoard(n);
    actions.forEach((action, i) => board.update(i % 2 === 0 ? "red" : "blue", action));
    return board;
  }

  override clone(): AgentBoard {
    const copy = new AgentBoard(this.n, this.data);
    copy.lastAction = this.lastAction;
    copy.lastPlayer = this.lastPlayer;
    copy.winner = this.winner;
    copy.turn = this.turn;
    return copy;
  }

  isOdd(): boolean {
    return this.n % 2 === 1;
  }

  /** Empty cells (the original returns a set; order is irrelevant to callers). */
  availableHexagons(): Coord[] {
    const out: Coord[] = [];
    for (let r = 0; r < this.n; r++) {
      for (let q = 0; q < this.n; q++) {
        if (!this.isOccupied(r, q)) out.push([r, q]);
      }
    }
    return out;
  }

  emptyCount(): number {
    let count = 0;
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === 0) count++;
    return count;
  }

  /** Apply an already-validated action. */
  update(player: Colour, action: Action): Coord[] {
    let captures: Coord[] = [];
    if (isSteal(action)) {
      this.swap();
    } else {
      captures = this.place(player, action[1], action[2]);
    }
    this.turn += 1;
    this.lastAction = action;
    this.lastPlayer = player;
    return captures;
  }
}
