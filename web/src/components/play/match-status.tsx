"use client";

import { AlertTriangle, Handshake, Loader2, Trophy } from "lucide-react";

import type { PlayerKind } from "@/lib/cachex/match";
import type { Game } from "@/lib/cachex/game";
import type { Colour } from "@/lib/cachex/types";
import { cn } from "@/lib/utils";
import { ColourDot, colourName } from "./primitives";

const GOAL: Record<Colour, string> = {
  red: "connect the top and bottom edges",
  blue: "connect the left and right edges",
};

const KIND_NAME: Record<PlayerKind, string> = {
  human: "You",
  minimax: "Minimax agent",
  random: "Random agent",
};

export function MatchStatus({
  game,
  kinds,
  thinking,
  error,
  perspective,
  paused = false,
}: {
  game: Game;
  kinds: Record<Colour, PlayerKind>;
  thinking: boolean;
  error: string | null;
  /** The human's colour in Play mode, so results read "You win". */
  perspective?: Colour;
  /** Spectator mode is paused. */
  paused?: boolean;
}) {
  const result = game.result;
  const toMove = game.turnPlayer();

  let icon = <ColourDot colour={toMove} className="size-3" />;
  let title: string;
  let detail: string;
  let tone: "neutral" | Colour | "gold" | "error" = toMove;

  if (error) {
    icon = <AlertTriangle className="text-destructive size-4" />;
    title = "Something went wrong";
    detail = error;
    tone = "error";
  } else if (result?.kind === "win") {
    icon = <Trophy className="text-gold size-4" />;
    const who = kinds[result.winner] === "human" ? "You win!" : `${colourName(result.winner)} wins`;
    title =
      perspective && result.winner !== perspective
        ? `${KIND_NAME[kinds[result.winner]]} wins`
        : who;
    detail = `${colourName(result.winner)} completed a chain in ${game.nturns} turns.`;
    tone = "gold";
  } else if (result?.kind === "draw") {
    icon = <Handshake className="text-muted-foreground size-4" />;
    title = "Draw";
    detail =
      result.reason === "repetition"
        ? "The same position occurred 7 times."
        : "The 343-turn limit was reached.";
    tone = "neutral";
  } else if (kinds[toMove] === "human") {
    title = perspective ? "Your move" : `${colourName(toMove)} to move`;
    detail = `${colourName(toMove)}: ${GOAL[toMove]}.${game.canSteal() ? " You may also steal Red's opening tile." : ""}`;
  } else {
    icon = thinking ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : icon;
    title = `${KIND_NAME[kinds[toMove]]} (${colourName(toMove)}) ${thinking ? "is thinking…" : "to move"}`;
    detail = paused
      ? `Paused. Press Play to run the match, or Step for a single move.`
      : `${colourName(toMove)} wants to ${GOAL[toMove]}.`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
        tone === "red" && "border-red-player/40 bg-red-player-soft",
        tone === "blue" && "border-blue-player/40 bg-blue-player-soft",
        tone === "gold" && "border-gold/50 bg-gold/10",
        tone === "error" && "border-destructive/40 bg-destructive/10",
        tone === "neutral" && "bg-muted/50",
      )}
    >
      <div className="mt-1">{icon}</div>
      <div className="min-w-0">
        <p className="font-display text-lg leading-tight font-semibold">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">{detail}</p>
      </div>
    </div>
  );
}
