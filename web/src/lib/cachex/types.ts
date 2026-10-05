export type Colour = "red" | "blue";

/** Internal token codes, identical to the referee: 0 empty, 1 red, 2 blue. */
export const EMPTY = 0;
export const RED_TOKEN = 1;
export const BLUE_TOKEN = 2;
export type Token = 0 | 1 | 2;

export type Coord = readonly [r: number, q: number];

export type PlaceAction = readonly ["PLACE", number, number];
export type StealAction = readonly ["STEAL"];
export type Action = PlaceAction | StealAction;

export const STEAL: StealAction = ["STEAL"];
export const place = (r: number, q: number): PlaceAction => ["PLACE", r, q];

export const isSteal = (a: Action): a is StealAction => a[0] === "STEAL";

export const TOKEN_OF: Record<Colour, Token> = { red: RED_TOKEN, blue: BLUE_TOKEN };
export const COLOUR_OF: Record<1 | 2, Colour> = { 1: "red", 2: "blue" };
/** `_SWAP_PLAYER` in the referee. */
export const SWAP_TOKEN: Record<Token, Token> = { 0: 0, 1: 2, 2: 1 };

export const opponent = (c: Colour): Colour => (c === "red" ? "blue" : "red");

/** Red aims to connect along the r axis (0), Blue along the q axis (1). */
export const PLAYER_AXIS: Record<Colour, 0 | 1> = { red: 0, blue: 1 };

export function actionKey(a: Action): string {
  return isSteal(a) ? "STEAL" : `${a[1]},${a[2]}`;
}

export function formatAction(a: Action): string {
  return isSteal(a) ? "STEAL" : `PLACE (${a[1]}, ${a[2]})`;
}

export function sameAction(a: Action | null, b: Action | null): boolean {
  if (a === null || b === null) return a === b;
  return actionKey(a) === actionKey(b);
}
