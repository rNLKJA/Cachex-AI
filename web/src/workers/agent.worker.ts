/**
 * Runs the ported agents off the main thread so the board stays responsive.
 */
import { type AgentRequest, runAgent } from "@/lib/agent/run-agent";

const ctx = self as unknown as {
  postMessage: (message: unknown) => void;
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<AgentRequest>) => void,
  ) => void;
};

ctx.addEventListener("message", (event) => {
  ctx.postMessage(runAgent(event.data));
});
