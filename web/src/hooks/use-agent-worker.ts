"use client";

import { useCallback, useEffect, useRef } from "react";

import { type AgentRequest, type AgentResponse, runAgent } from "@/lib/agent/run-agent";

type Pending = Map<number, (response: AgentResponse) => void>;

/**
 * Owns one agent Web Worker for the lifetime of the component and returns a
 * promise-based `request` function. Falls back to the main thread if workers
 * are unavailable.
 */
export function useAgentWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Pending>(new Map());
  const nextId = useRef(0);

  useEffect(() => {
    const pending = pendingRef.current;
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("../workers/agent.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<AgentResponse>) => {
        const resolve = pending.get(event.data.id);
        pending.delete(event.data.id);
        resolve?.(event.data);
      };
      worker.onerror = () => {
        for (const [id, resolve] of pending)
          resolve({ id, ok: false, error: "The agent worker crashed." });
        pending.clear();
      };
    } catch {
      worker = null;
    }
    workerRef.current = worker;
    return () => {
      worker?.terminate();
      workerRef.current = null;
      pending.clear();
    };
  }, []);

  return useCallback((req: Omit<AgentRequest, "id">) => {
    const id = ++nextId.current;
    return new Promise<AgentResponse>((resolve) => {
      const worker = workerRef.current;
      if (worker) {
        pendingRef.current.set(id, resolve);
        worker.postMessage({ ...req, id });
      } else {
        setTimeout(() => resolve(runAgent({ ...req, id })), 0);
      }
    });
  }, []);
}
