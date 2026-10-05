/**
 * TypeScript port of the referee's game rules
 * (coursework/Project Part B/code/referee/game.py, class `Game`):
 * turn order, action validation, STEAL, captures, win and draw detection.
 */
import { Board } from "./board";
import { type Action, type Colour, type Coord, PLAYER_AXIS, formatAction, isSteal } from "./types";

export const PLAYER_TURN_ORDER: readonly Colour[] = ["red", "blue"];
export const MAX_REPEAT_STATES = 7;
export const MAX_TURNS = 343;

export type GameResult =
  | { kind: "win"; winner: Colour; cluster: Coord[] }
  | { kind: "draw"; reason: "repetition" | "max-turns" };

export class IllegalActionError extends Error {
  constructor(
    message: string,
    readonly action: Action,
  ) {
    super(`${message} (${formatAction(action)})`);
    this.name = "IllegalActionError";
  }
}

export interface TurnRecord {
  turn: number;
  player: Colour;
  action: Action;
  captures: Coord[];
}

export class Game {
  readonly n: number;
  board: Board;
  nturns = 0;
  lastCaptures: Coord[] = [];
  lastCoord: Coord = [-1, -1];
  history = new Map<string, number>();
  result: GameResult | null = null;
  log: TurnRecord[] = [];

  constructor(n: number) {
    if (!Number.isInteger(n) || n < 1) throw new Error(`invalid board size ${n}`);
    this.n = n;
    this.board = new Board(n);
    this.history.set(this.board.digest(), 1);
  }

  /** Rebuild a game by replaying a list of actions from the start. */
  static fromActions(n: number, actions: readonly Action[]): Game {
    const game = new Game(n);
    for (const action of actions) game.update(game.turnPlayer(), action);
    return game;
  }

  turnPlayer(): Colour {
    return PLAYER_TURN_ORDER[this.nturns % 2];
  }

  over(): boolean {
    return this.result !== null;
  }

  /** True iff STEAL is currently a legal action (Blue's first move only). */
  canSteal(): boolean {
    return this.nturns === 1 && !this.over();
  }

  /** True iff (r, q) is the centre cell and this is the first move of the game. */
  isForbiddenOpening(r: number, q: number): boolean {
    return this.nturns === 0 && r * 2 === this.n - 1 && q * 2 === this.n - 1;
  }

  isLegal(action: Action): boolean {
    if (this.over()) return false;
    if (isSteal(action)) return this.nturns === 1;
    const [, r, q] = action;
    return (
      this.board.insideBounds(r, q) &&
      !this.isForbiddenOpening(r, q) &&
      !this.board.isOccupied(r, q)
    );
  }

  legalPlacements(): Coord[] {
    const out: Coord[] = [];
    for (let r = 0; r < this.n; r++) {
      for (let q = 0; q < this.n; q++) {
        if (this.isLegal(["PLACE", r, q])) out.push([r, q]);
      }
    }
    return out;
  }

  /** Validate and apply an action, then check for end conditions. */
  update(player: Colour, action: Action): Action {
    if (this.over()) throw new IllegalActionError("The game is already over.", action);
    if (player !== this.turnPlayer()) {
      throw new IllegalActionError(`It is not ${player}'s turn!`, action);
    }

    if (isSteal(action)) {
      if (this.nturns !== 1) {
        throw new IllegalActionError(
          "STEAL may only be played by Blue on their first move.",
          action,
        );
      }
      this.board.swap();
      this.lastCoord = [-1, -1];
      this.lastCaptures = [];
    } else {
      const [, r, q] = action;
      if (!Number.isInteger(r) || !Number.isInteger(q) || !this.board.insideBounds(r, q)) {
        throw new IllegalActionError(`(${r}, ${q}) is outside the board (n = ${this.n}).`, action);
      }
      if (this.isForbiddenOpening(r, q)) {
        throw new IllegalActionError(
          "The centre cell cannot be taken on the first move of the game.",
          action,
        );
      }
      if (this.board.isOccupied(r, q)) {
        throw new IllegalActionError(`(${r}, ${q}) is already occupied.`, action);
      }
      this.lastCaptures = this.board.place(player, r, q);
      this.lastCoord = [r, q];
    }

    this.log.push({
      turn: this.nturns + 1,
      player,
      action,
      captures: this.lastCaptures,
    });
    this.turnDetectEnd(player, action);
    return action;
  }

  private turnDetectEnd(player: Colour, action: Action): void {
    this.nturns += 1;
    const digest = this.board.digest();
    const seen = (this.history.get(digest) ?? 0) + 1;
    this.history.set(digest, seen);

    // Condition 1: a continuous path spanning the board (only possible after 2n - 1 turns).
    if (this.nturns >= this.n * 2 - 1 && !isSteal(action)) {
      const [, r, q] = action;
      const reachable = this.board.connectedCoords(r, q);
      const axis = PLAYER_AXIS[player];
      const vals = reachable.map((c) => c[axis]);
      if (Math.min(...vals) === 0 && Math.max(...vals) === this.n - 1) {
        this.result = { kind: "win", winner: player, cluster: reachable };
        return;
      }
    }

    // Condition 2: the same state has occurred too many times.
    if (seen >= MAX_REPEAT_STATES) {
      this.result = { kind: "draw", reason: "repetition" };
      return;
    }

    // Condition 3: too many turns.
    if (this.nturns >= MAX_TURNS) {
      this.result = { kind: "draw", reason: "max-turns" };
    }
  }
}
