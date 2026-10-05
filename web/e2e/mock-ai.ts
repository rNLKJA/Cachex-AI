/**
 * A mocked AI provider for the tour. No real key is ever used: the visitor's
 * "key" is a placeholder, every request to the provider is intercepted in the
 * browser context, and the reply is generated here.
 *
 * The mocked model plays the first legal cell it is offered (the same rule as
 * the scripted baseline), and its reason says that it is a mock, so nothing
 * in the recording can be mistaken for a real model's behaviour.
 */
import type { BrowserContext, Request } from "@playwright/test";

import { MOCK_MODEL_ID } from "../src/lib/showcase";

/** Not a credential: an obviously fake placeholder typed into the BYOK dialog. */
export const PLACEHOLDER_KEY = "placeholder-not-a-real-key";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};

/** First "(r, q)" in the prompt's list of legal moves. */
export function firstLegalCell(prompt: string): [number, number] {
  const line = prompt.split("\n").find((l) => l.startsWith("Legal moves"));
  const m = line?.match(/\((\d+), (\d+)\)/);
  if (!m) throw new Error(`No legal moves in prompt: ${prompt.slice(0, 200)}`);
  return [Number(m[1]), Number(m[2])];
}

export interface MockAi {
  /** Requests that reached the mock (each one an AI call the app made). */
  calls: number;
  /** Requests to anything else that carried the placeholder key (must stay empty). */
  leaks: string[];
}

export async function mockAiProviders(
  context: BrowserContext,
  { latencyMs = 350 }: { latencyMs?: number } = {},
): Promise<MockAi> {
  const state: MockAi = { calls: 0, leaks: [] };

  await context.route("https://api.openai.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    state.calls += 1;
    const body = JSON.parse(req.postData() ?? "{}") as {
      messages?: { role: string; content: string }[];
    };
    const user = body.messages?.find((m) => m.role === "user")?.content ?? "";
    const [r, q] = firstLegalCell(user);
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({
        id: `chatcmpl-mock-${state.calls}`,
        object: "chat.completion",
        model: MOCK_MODEL_ID,
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify({
                action: "PLACE",
                r,
                q,
                reason: "Mocked response for illustration: the first legal cell.",
              }),
            },
          },
        ],
        // No usage block: the mock has no token counts to report.
      }),
    });
  });

  // The tour never uses Anthropic; block it so nothing can leave the browser.
  await context.route("https://api.anthropic.com/**", (route) => route.abort("blockedbyclient"));

  context.on("request", (req: Request) => {
    if (req.url().startsWith("https://api.openai.com/")) return;
    const headers = JSON.stringify(req.headers());
    const data = req.postData() ?? "";
    if (
      headers.includes(PLACEHOLDER_KEY) ||
      data.includes(PLACEHOLDER_KEY) ||
      req.url().includes(PLACEHOLDER_KEY)
    ) {
      state.leaks.push(req.url());
    }
  });

  return state;
}
