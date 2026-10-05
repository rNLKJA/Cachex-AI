"use client";

import { Bot, Dice5, User } from "lucide-react";
import { useEffect, useRef } from "react";

import type { MoveMeta } from "@/hooks/use-cachex-match";
import type { PlayerKind } from "@/lib/cachex/match";
import type { TurnRecord } from "@/lib/cachex/game";
import type { Colour } from "@/lib/cachex/types";
import { cn } from "@/lib/utils";
import { ColourDot } from "./primitives";

const KIND_ICON = { human: User, minimax: Bot, random: Dice5 } as const;

export function MoveLog({
  log,
  kinds,
  meta,
  selected,
  onSelect,
}: {
  log: readonly TurnRecord[];
  kinds: Record<Colour, PlayerKind>;
  meta: Record<number, MoveMeta>;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  if (log.length === 0) {
    return <p className="text-muted-foreground text-sm">No moves yet. Red always moves first.</p>;
  }

  return (
    <ol
      ref={listRef}
      className="max-h-64 space-y-1 overflow-y-auto pr-1 text-sm"
      aria-label="Move log"
    >
      {log.map((t, i) => {
        const Icon = KIND_ICON[kinds[t.player]];
        const hasWhy = meta[i] !== undefined && kinds[t.player] === "minimax";
        const content = (
          <>
            <span className="text-muted-foreground w-6 shrink-0 text-right font-mono text-xs tabular-nums">
              {t.turn}
            </span>
            <ColourDot colour={t.player} />
            <Icon
              className="text-muted-foreground size-3.5 shrink-0"
              aria-label={kinds[t.player]}
            />
            <span className="font-mono text-[0.8rem]">
              {t.action[0] === "STEAL" ? "STEAL" : `(${t.action[1]}, ${t.action[2]})`}
            </span>
            {t.captures.length > 0 && (
              <span className="bg-gold/15 text-gold-ink rounded-full px-1.5 py-0.5 text-[0.7rem] font-medium">
                captured {t.captures.length}
              </span>
            )}
            {hasWhy && <span className="text-muted-foreground ml-auto text-xs">why?</span>}
          </>
        );
        return (
          <li key={i}>
            {hasWhy ? (
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-pressed={selected === i}
                className={cn(
                  "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors",
                  selected === i && "bg-muted",
                )}
              >
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
