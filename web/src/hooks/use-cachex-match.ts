"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MoveExplanation } from "@/lib/agent/player";
import type { AgentResponse } from "@/lib/agent/run-agent";
import {
  type PlayerKind,
  deriveMatchView,
  evaluationTrend,
  undoToHumanTurn,
} from "@/lib/cachex/match";
import { Game } from "@/lib/cachex/game";
import type { Action, Colour } from "@/lib/cachex/types";
import { useAgentWorker } from "./use-agent-worker";

export interface MatchConfig {
  n: number;
  red: PlayerKind;
  blue: PlayerKind;
  seed: number;
}

export interface MatchOptions {
  /** Let AI players move automatically. */
  autoPlay: boolean;
  /** Minimum time an AI move takes on screen, in ms. */
  moveDelayMs: number;
}

export interface MoveMeta {
  explanation: MoveExplanation;
  elapsedMs: number;
}

/**
 * Game state for a match between any mix of humans and agents. The action
 * list is the single source of truth; everything else is derived from it.
 */
export function useCachexMatch(config: MatchConfig, options: MatchOptions) {
  const request = useAgentWorker();
  const [actions, setActions] = useState<Action[]>([]);
  const [meta, setMeta] = useState<Record<number, MoveMeta>>({});
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const busy = inFlight > 0;
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const view = useMemo(() => deriveMatchView(config.n, actions), [config.n, actions]);
  const trend = useMemo(() => evaluationTrend(config.n, actions), [config.n, actions]);
  const { game } = view;
  const toMove: Colour = game.turnPlayer();
  const toMoveKind = config[toMove];
  const isOver = game.over();
  const isAiTurn = !isOver && toMoveKind !== "human";

  const applyResponse = useCallback((snapshot: Action[], res: AgentResponse) => {
    if (actionsRef.current !== snapshot) return; // the position changed (undo/reset)
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const index = snapshot.length;
    const next = [...snapshot, res.decision.action];
    actionsRef.current = next;
    setActions(next);
    setMeta((prev) => ({
      ...prev,
      [index]: { explanation: res.decision.explanation, elapsedMs: res.elapsedMs },
    }));
  }, []);

  const askAgent = useCallback(
    (snapshot: Action[], minDelay: number, isCancelled: () => boolean = () => false) => {
      const kind = config[snapshot.length % 2 === 0 ? "red" : "blue"];
      if (kind === "human") return Promise.resolve();
      const started = performance.now();
      return request({
        kind,
        n: config.n,
        history: snapshot,
        colour: snapshot.length % 2 === 0 ? "red" : "blue",
        seed: (config.seed + snapshot.length * 7919) >>> 0,
      }).then(
        (res) =>
          new Promise<void>((resolve) => {
            const wait = Math.max(0, minDelay - (performance.now() - started));
            setTimeout(() => {
              if (!isCancelled()) applyResponse(snapshot, res);
              resolve();
            }, wait);
          }),
      );
    },
    [applyResponse, config, request],
  );

  // Automatic AI moves.
  useEffect(() => {
    if (!isAiTurn || !options.autoPlay || error) return;
    let cancelled = false;
    const snapshot = actions;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setInFlight((c) => c + 1);
      askAgent(snapshot, options.moveDelayMs, () => cancelled).finally(() =>
        setInFlight((c) => c - 1),
      );
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [actions, askAgent, error, isAiTurn, options.autoPlay, options.moveDelayMs]);

  const play = useCallback(
    (action: Action) => {
      const current = actionsRef.current;
      const g = Game.fromActions(config.n, current);
      if (config[g.turnPlayer()] !== "human" || !g.isLegal(action)) return false;
      const next = [...current, action];
      actionsRef.current = next;
      setActions(next);
      return true;
    },
    [config],
  );

  /** Advance one AI move (used by the spectator's Step button). */
  const step = useCallback(() => {
    if (!isAiTurn || busy) return;
    setInFlight((c) => c + 1);
    askAgent(actionsRef.current, 0).finally(() => setInFlight((c) => c - 1));
  }, [askAgent, busy, isAiTurn]);

  const undo = useCallback(() => {
    const next = undoToHumanTurn(actionsRef.current, { red: config.red, blue: config.blue });
    actionsRef.current = next;
    setError(null);
    setActions(next);
    setMeta((m) => Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) < next.length)));
  }, [config.blue, config.red]);

  const reset = useCallback(() => {
    const next: Action[] = [];
    actionsRef.current = next;
    setError(null);
    setMeta({});
    setActions(next);
  }, []);

  const canUndo = actions.some((_, i) => config[i % 2 === 0 ? "red" : "blue"] === "human");

  return {
    actions,
    view,
    trend,
    meta,
    error,
    toMove,
    toMoveKind,
    isAiTurn,
    thinking: isAiTurn && (busy || options.autoPlay) && !error,
    play,
    step,
    undo,
    reset,
    canUndo,
  };
}
