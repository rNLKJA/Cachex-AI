/**
 * AI client tests. No network: every provider call goes through a mocked
 * fetch, so these tests also pin down exactly what is sent (and what is not).
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { chooseAgentAction } from "@/lib/agent/player";
import { type Action, place, STEAL } from "@/lib/cachex/types";
import { callAnthropic } from "./anthropic";
import { MemoryAuditStore, auditToCsv, auditToJson } from "./audit-log";
import { callStructured } from "./client";
import {
  COMMENTATOR_MAX_TOKENS,
  type Commentary,
  CommentarySchema,
  buildCommentaryFacts,
  commentaryPrompt,
  commentaryRequest,
  commentaryToText,
  forcedWinner,
  groundingCheck,
  mentionedNumbers,
  parseCommentaryFacts,
  recheckLoggedCommentary,
} from "./commentator";
import {
  LLM_PLAYER_MAX_TOKENS,
  type LlmMove,
  LlmMoveSchema,
  buildMovePrompt,
  completedSchedule,
  firstLegalAction,
  type LlmGameRecord,
  legalMoves,
  llmGamesCsvRows,
  pairWithLlm,
  playBaselineGame,
  playLlmGame,
  renderBoard,
  scheduleGames,
  summariseBaseline,
  summariseLlmGames,
  validateMove,
} from "./llm-player";
import { DEFAULT_ANTHROPIC_MODEL, supportsEffort } from "./models";
import { OPENAI_URL, callOpenAI, strictJsonSchema } from "./openai";
import { anthropicJsonSchema } from "./schema";
import {
  DEFAULT_PREFS,
  type SettingsDraft,
  forgetAllKeys,
  forgetKey,
  initialRemember,
  loadAllKeys,
  loadKey,
  loadPrefs,
  maskKey,
  planSettingsSave,
  saveKey,
  savePrefs,
} from "./settings";
import { AiError, type FetchLike, type StructuredRequest } from "./types";
import { Game } from "@/lib/cachex/game";
import { tournamentMove } from "@/lib/tournament/agents";
import { createRng, deriveSeed } from "@/lib/rng";
import { wilson } from "@/lib/stats/proportion";

const KEY = "sk-test-0123456789-SECRET";

const Answer = z.object({ answer: z.number(), note: z.string() });
const request: StructuredRequest<z.infer<typeof Answer>> = {
  feature: "commentator",
  system: "You are terse.",
  user: "What is 2 + 2?",
  schema: Answer,
  schemaName: "answer",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const anthropicMessage = (text: string, extra: Record<string, unknown> = {}) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-haiku-4-5",
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 120, output_tokens: 18 },
  ...extra,
});

function headerOf(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

describe("Anthropic adapter", () => {
  it("calls the Messages API from the browser with structured output", async () => {
    const fetch = vi.fn<FetchLike>(async () =>
      json(anthropicMessage('{"answer": 4, "note": "easy"}')),
    );
    const res = await callAnthropic(KEY, DEFAULT_ANTHROPIC_MODEL, request, { fetch });
    expect(res.data).toEqual({ answer: 4, note: "easy" });
    expect(res.usage).toEqual({ inputTokens: 120, outputTokens: 18 });

    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    expect(headerOf(init, "x-api-key")).toBe(KEY);
    expect(headerOf(init, "anthropic-dangerous-direct-browser-access")).toBe("true");
    expect(headerOf(init, "anthropic-version")).toBeTruthy();
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.system).toBe("You are terse.");
    expect(body.messages).toEqual([{ role: "user", content: "What is 2 + 2?" }]);
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema).toMatchObject({
      type: "object",
      required: ["answer", "note"],
      additionalProperties: false,
    });
    expect(body.output_config.effort).toBeUndefined(); // Haiku takes no effort setting
  });

  it("sends enums (not just a description) and drops unsupported numeric bounds", async () => {
    const fetch = vi.fn<FetchLike>(async () =>
      json(anthropicMessage('{"action": "PLACE", "r": 1, "q": 2, "reason": "x"}')),
    );
    await callAnthropic(
      KEY,
      DEFAULT_ANTHROPIC_MODEL,
      { ...request, schema: LlmMoveSchema, schemaName: "cachex_move" },
      { fetch },
    );
    const schema = JSON.parse(String(fetch.mock.calls[0][1]?.body)).output_config.format.schema;
    expect(schema.properties.action).toEqual({ type: "string", enum: ["PLACE", "STEAL"] });
    expect(schema.properties.r).not.toHaveProperty("minimum");
    expect(schema.properties.r).not.toHaveProperty("maximum");
    expect(schema.properties.r.type).toBe("integer");
    expect(schema).not.toHaveProperty("$schema");
    expect(JSON.stringify(schema)).not.toContain("{enum:");
    // Commentary: nested enums survive too.
    const commentary = anthropicJsonSchema(CommentarySchema) as {
      properties: { key_factors: { items: { properties: Record<string, { enum?: string[] }> } } };
    };
    expect(commentary.properties.key_factors.items.properties.effect.enum).toEqual([
      "favours_red",
      "favours_blue",
      "neutral",
    ]);
  });

  it("checks stop_reason before parsing: a cut-off reply is truncated, not invalid", async () => {
    const cutOff = vi.fn(async () =>
      json(
        anthropicMessage('{"action":"PLACE","r":1,"q":', {
          stop_reason: "max_tokens",
          usage: { input_tokens: 300, output_tokens: 1024 },
        }),
      ),
    );
    const err = await callAnthropic(KEY, DEFAULT_ANTHROPIC_MODEL, request, {
      fetch: cutOff,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err).toMatchObject({
      kind: "truncated",
      rawText: '{"action":"PLACE","r":1,"q":',
      usage: { inputTokens: 300, outputTokens: 1024 },
    });

    const refusedWithText = vi.fn(async () =>
      json(
        anthropicMessage("I can't help with that.", {
          stop_reason: "refusal",
          stop_details: { type: "refusal", category: null, explanation: "declined" },
        }),
      ),
    );
    await expect(
      callAnthropic(KEY, DEFAULT_ANTHROPIC_MODEL, request, { fetch: refusedWithText }),
    ).rejects.toMatchObject({ kind: "refusal", rawText: "I can't help with that." });
  });

  it("asks Sonnet for low effort", async () => {
    const fetch = vi.fn(async () => json(anthropicMessage('{"answer": 4, "note": "x"}')));
    await callAnthropic(KEY, "claude-sonnet-5-5", request, { fetch });
    const body = JSON.parse(
      String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(body.output_config.effort).toBe("low");
    expect(supportsEffort("claude-haiku-4-5")).toBe(false);
  });

  it.each([
    [
      401,
      { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
      "invalid-key",
    ],
    [403, { type: "error", error: { type: "permission_error", message: "no" } }, "permission"],
    [
      429,
      { type: "error", error: { type: "rate_limit_error", message: "slow down" } },
      "rate-limit",
    ],
    [529, { type: "error", error: { type: "overloaded_error", message: "busy" } }, "overloaded"],
    [
      400,
      { type: "error", error: { type: "invalid_request_error", message: "bad" } },
      "bad-request",
    ],
  ])("maps HTTP %i to a friendly error", async (status, body, kind) => {
    const fetch = vi.fn(async () => json(body, status));
    await expect(
      callAnthropic(KEY, DEFAULT_ANTHROPIC_MODEL, request, { fetch }),
    ).rejects.toMatchObject({
      kind,
    });
  });

  it("reports network/CORS failures, refusals and bad output", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      callAnthropic(KEY, DEFAULT_ANTHROPIC_MODEL, request, { fetch: offline }),
    ).rejects.toMatchObject({
      kind: "network",
    });
    const refusal = vi.fn(async () =>
      json(anthropicMessage("", { stop_reason: "refusal", content: [] })),
    );
    await expect(
      callAnthropic(KEY, DEFAULT_ANTHROPIC_MODEL, request, { fetch: refusal }),
    ).rejects.toMatchObject({
      kind: "refusal",
    });
    const bad = vi.fn(async () => json(anthropicMessage('{"answer": "four"}')));
    await expect(
      callAnthropic(KEY, DEFAULT_ANTHROPIC_MODEL, request, { fetch: bad }),
    ).rejects.toMatchObject({
      kind: "invalid-output",
      rawText: '{"answer": "four"}',
      usage: { inputTokens: 120, outputTokens: 18 },
    });
    const notJson = vi.fn(async () => json(anthropicMessage("four")));
    await expect(
      callAnthropic(KEY, DEFAULT_ANTHROPIC_MODEL, request, { fetch: notJson }),
    ).rejects.toMatchObject({ kind: "invalid-output", rawText: "four" });
  });
});

describe("OpenAI adapter", () => {
  const completion = (content: string, extra: Record<string, unknown> = {}) => ({
    model: "gpt-5-mini",
    choices: [{ finish_reason: "stop", message: { content, refusal: null } }],
    usage: { prompt_tokens: 90, completion_tokens: 12 },
    ...extra,
  });

  it("sends a strict JSON-schema response format with a bearer key", async () => {
    const fetch = vi.fn<FetchLike>(async () => json(completion('{"answer": 4, "note": "ok"}')));
    const res = await callOpenAI(KEY, "gpt-5-mini", request, { fetch });
    expect(res.data).toEqual({ answer: 4, note: "ok" });
    expect(res.usage).toEqual({ inputTokens: 90, outputTokens: 12 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(OPENAI_URL);
    expect(headerOf(init, "authorization")).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(String(init?.body));
    expect(body.messages[0]).toEqual({ role: "system", content: "You are terse." });
    expect(body.max_completion_tokens).toBe(2048); // same default budget as Anthropic
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema).toMatchObject({
      type: "object",
      required: ["answer", "note"],
      additionalProperties: false,
    });
  });

  it("uses the caller's token budget, like the Anthropic adapter", async () => {
    const fetch = vi.fn<FetchLike>(async () => json(completion('{"answer": 4, "note": "ok"}')));
    await callOpenAI(KEY, "gpt-5-mini", { ...request, maxTokens: 4096 }, { fetch });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).max_completion_tokens).toBe(4096);
  });

  it("makes nested objects strict too", () => {
    const s = strictJsonSchema({
      $schema: "x",
      type: "object",
      properties: { a: { type: "object", properties: { b: { type: "string" } } } },
    });
    expect(s.$schema).toBeUndefined();
    expect((s.properties as { a: Record<string, unknown> }).a).toMatchObject({
      required: ["b"],
      additionalProperties: false,
    });
  });

  it.each([
    [401, "invalid-key"],
    [429, "rate-limit"],
    [500, "server"],
    [503, "overloaded"],
  ])("maps HTTP %i", async (status, kind) => {
    const fetch = vi.fn(async () => json({ error: { message: "nope", code: "x" } }, status));
    await expect(callOpenAI(KEY, "gpt-5-mini", request, { fetch })).rejects.toMatchObject({ kind });
  });

  it("handles refusals, truncation, invalid JSON and network errors", async () => {
    const cases: [Response | Error, string][] = [
      [
        json(
          completion("", {
            choices: [{ finish_reason: "stop", message: { content: null, refusal: "no" } }],
          }),
        ),
        "refusal",
      ],
      [
        json(
          completion("{", { choices: [{ finish_reason: "length", message: { content: "{" } }] }),
        ),
        "truncated",
      ],
      [json(completion("not json")), "invalid-output"],
      [json(completion('{"answer": 1}')), "invalid-output"],
      [new TypeError("Failed to fetch"), "network"],
    ];
    const truncated = vi.fn(async () =>
      json(completion("{", { choices: [{ finish_reason: "length", message: { content: "{" } }] })),
    );
    await expect(
      callOpenAI(KEY, "gpt-5-mini", request, { fetch: truncated }),
    ).rejects.toMatchObject({
      kind: "truncated",
      rawText: "{",
      usage: { inputTokens: 90, outputTokens: 12 },
    });
    for (const [out, kind] of cases) {
      const fetch = vi.fn(async () => {
        if (out instanceof Error) throw out;
        return out;
      });
      await expect(callOpenAI(KEY, "gpt-5-mini", request, { fetch })).rejects.toMatchObject({
        kind,
      });
    }
  });
});

describe("audited calls", () => {
  it("logs successful calls without the key", async () => {
    const audit = new MemoryAuditStore();
    const fetch = vi.fn(async () => json(anthropicMessage('{"answer": 4, "note": "x"}')));
    let t = 100;
    const res = await callStructured(
      { provider: "anthropic", model: DEFAULT_ANTHROPIC_MODEL, apiKey: KEY },
      request,
      {
        audit,
        fetch,
        now: () => (t += 250),
        clock: () => new Date("2026-10-06T00:00:00Z"),
        context: { seed: 7 },
      },
    );
    expect(res.data.answer).toBe(4);
    const [entry] = await audit.list();
    expect(entry).toMatchObject({
      feature: "commentator",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      timestamp: "2026-10-06T00:00:00.000Z",
      input: { system: "You are terse.", user: "What is 2 + 2?", schema: "answer" },
      output: { answer: 4, note: "x" },
      latencyMs: 250,
      usage: { inputTokens: 120, outputTokens: 18 },
      humanDecision: "pending",
      error: null,
      context: { seed: 7 },
    });
    expect(JSON.stringify(entry)).not.toContain(KEY);
    expect(auditToCsv([entry])).not.toContain(KEY);
    expect(auditToJson([entry])).not.toContain(KEY);
  });

  it("logs failures too, then rethrows", async () => {
    const audit = new MemoryAuditStore();
    const fetch = vi.fn(async () =>
      json({ type: "error", error: { type: "authentication_error", message: "bad key" } }, 401),
    );
    await expect(
      callStructured(
        { provider: "anthropic", model: DEFAULT_ANTHROPIC_MODEL, apiKey: KEY },
        request,
        { audit, fetch },
      ),
    ).rejects.toBeInstanceOf(AiError);
    const [entry] = await audit.list();
    expect(entry.error?.kind).toBe("invalid-key");
    expect(entry.output).toBeNull();
    expect(JSON.stringify(entry)).not.toContain(KEY);
  });

  it("keeps the raw reply and billed tokens when validation fails", async () => {
    const audit = new MemoryAuditStore();
    const fetch = vi.fn(async () =>
      json(
        anthropicMessage('{"answer": "four", "note"', {
          stop_reason: "max_tokens",
          usage: { input_tokens: 400, output_tokens: 1024 },
        }),
      ),
    );
    await expect(
      callStructured(
        { provider: "anthropic", model: DEFAULT_ANTHROPIC_MODEL, apiKey: KEY },
        request,
        { audit, fetch },
      ),
    ).rejects.toMatchObject({ kind: "truncated" });
    const [entry] = await audit.list();
    expect(entry).toMatchObject({
      output: null,
      outputText: '{"answer": "four", "note"',
      usage: { inputTokens: 400, outputTokens: 1024 },
      error: { kind: "truncated" },
    });
    expect(JSON.stringify(entry)).not.toContain(KEY);
    expect(auditToCsv([entry])).toContain("1024");
    expect(auditToCsv([entry])).not.toContain(KEY);
    expect(auditToJson([entry])).not.toContain(KEY);
  });

  it("refuses to call without a key", async () => {
    const audit = new MemoryAuditStore();
    const fetch = vi.fn();
    await expect(
      callStructured({ provider: "openai", model: "gpt-5-mini", apiKey: "  " }, request, {
        audit,
        fetch,
      }),
    ).rejects.toMatchObject({ kind: "missing-key" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("audit log store and export", () => {
  it("adds, updates, lists newest first and clears", async () => {
    const store = new MemoryAuditStore();
    const base = {
      feature: "commentator" as const,
      provider: "openai" as const,
      model: "m",
      input: { system: "s", user: "u", schema: "x" },
      output: { a: 1 },
      outputText: '{"a":1}',
      error: null,
      latencyMs: 5,
      usage: null,
      humanDecision: "pending" as const,
    };
    await store.add({ ...base, id: "a", timestamp: "2026-01-01T00:00:00Z" });
    await store.add({ ...base, id: "b", timestamp: "2026-02-01T00:00:00Z" });
    await store.update("a", { humanDecision: "edited", editedOutput: "=SUM(A1)", decidedAt: "x" });
    const list = await store.list();
    expect(list.map((e) => e.id)).toEqual(["b", "a"]);
    expect(list[1].humanDecision).toBe("edited");
    const csv = auditToCsv(list);
    expect(csv.split("\r\n")[0]).toContain("human_decision");
    expect(csv).toContain("'=SUM(A1)");
    await store.clear();
    expect(await store.list()).toEqual([]);
  });
});

describe("key and preference storage", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      size: () => m.size,
    };
  };

  it("keeps the key in sessionStorage unless asked to remember it", () => {
    const session = memory();
    const local = memory();
    saveKey("anthropic", ` ${KEY} `, false, session, local);
    expect(loadKey("anthropic", session, local)).toEqual({ key: KEY, remembered: false });
    expect(local.size()).toBe(0);

    saveKey("anthropic", KEY, true, session, local);
    expect(loadKey("anthropic", session, local)).toEqual({ key: KEY, remembered: true });
    expect(session.size()).toBe(0);
    expect(loadKey("openai", session, local)).toBeNull();

    forgetKey("anthropic", session, local);
    expect(loadKey("anthropic", session, local)).toBeNull();
    expect(session.size() + local.size()).toBe(0);
  });

  it("forgets every provider's key, not just the selected one", () => {
    const session = memory();
    const local = memory();
    saveKey("anthropic", KEY, true, session, local); // remembered on this device
    saveKey("openai", "sk-openai-test-123456", false, session, local);
    expect(Object.keys(loadAllKeys(session, local)).sort()).toEqual(["anthropic", "openai"]);
    forgetAllKeys(session, local);
    expect(loadAllKeys(session, local)).toEqual({});
    expect(session.size() + local.size()).toBe(0);
  });

  it("stores preferences separately and recovers from bad data", () => {
    const local = memory();
    expect(loadPrefs(local)).toEqual(DEFAULT_PREFS);
    savePrefs(local, {
      provider: "openai",
      anthropicModel: "claude-sonnet-5-5",
      openaiModel: "gpt-x",
    });
    expect(loadPrefs(local).provider).toBe("openai");
    local.setItem("cachex-arena.ai.prefs", "{oops");
    expect(loadPrefs(local)).toEqual(DEFAULT_PREFS);
    expect(maskKey(KEY)).toBe("sk-tes…CRET");
    expect(maskKey("short")).toBe("•••••");
  });
});

describe("settings dialog save", () => {
  const OPENAI_KEY = "sk-openai-tab-only-0001";
  // An OpenAI key saved for this tab only, an Anthropic key remembered on the device.
  const saved = {
    openai: { key: OPENAI_KEY, remembered: false },
    anthropic: { key: KEY, remembered: true },
  };
  const draft = (over: Partial<SettingsDraft>): SettingsDraft => ({
    provider: "anthropic",
    anthropicModel: DEFAULT_PREFS.anthropicModel,
    openaiModel: DEFAULT_PREFS.openaiModel,
    key: "",
    remember: false,
    rememberTouched: false,
    ...over,
  });

  it("never moves a tab-only key into local storage after a provider switch", () => {
    // Open the dialog on Anthropic (box ticked), switch to OpenAI, press Save.
    expect(initialRemember("anthropic", saved)).toBe(true);
    const remember = initialRemember("openai", saved);
    expect(remember).toBe(false);
    const plan = planSettingsSave(draft({ provider: "openai", remember }), saved);
    expect(plan.key).toBeNull();
    expect(plan.prefs.provider).toBe("openai");
    // Even a stale ticked box does nothing unless the visitor changed it.
    expect(planSettingsSave(draft({ provider: "openai", remember: true }), saved).key).toBeNull();
  });

  it("moves a saved key only when the visitor changes the box for that provider", () => {
    expect(
      planSettingsSave(draft({ provider: "openai", remember: true, rememberTouched: true }), saved)
        .key,
    ).toEqual({ provider: "openai", key: OPENAI_KEY, remember: true });
    expect(
      planSettingsSave(
        draft({ provider: "anthropic", remember: true, rememberTouched: true }),
        saved,
      ).key,
    ).toBeNull(); // already remembered
  });

  it("saves a typed key for the selected provider with the box as shown", () => {
    const plan = planSettingsSave(
      draft({ provider: "openai", key: "  sk-new-0002  ", openaiModel: "  " }),
      saved,
    );
    expect(plan.key).toEqual({ provider: "openai", key: "sk-new-0002", remember: false });
    expect(plan.prefs.openaiModel).toBe(DEFAULT_PREFS.openaiModel);
  });
});

describe("commentator", () => {
  const history = [place(1, 1), place(3, 2), place(2, 2), place(0, 3)];
  const decision = chooseAgentAction(5, history, "red", { fixedDepth: 2 });
  if (decision.explanation.kind !== "search") throw new Error("expected a search");
  const facts = buildCommentaryFacts({
    n: 5,
    turn: 5,
    colour: "red",
    action: decision.action,
    explanation: decision.explanation,
  });

  it("passes only the agent's own facts to the model", () => {
    expect(facts.features_after_move).toHaveLength(6);
    expect(facts.search.depth).toBe(2);
    expect(facts.top_candidates.length).toBeLessThanOrEqual(5);
    const total = facts.features_after_move.reduce((s, f) => s + f.contribution, 0);
    expect(facts.evaluation_total).toBeCloseTo(total, 6);
    const prompt = commentaryPrompt(facts);
    expect(prompt.system).toContain("Use ONLY the facts");
    expect(prompt.user).toContain(JSON.stringify(facts, null, 2));
  });

  it("sends one request with room for a reasoning model's thinking, to either provider", async () => {
    const req = commentaryRequest(facts);
    expect(req).toMatchObject({
      feature: "commentator",
      schemaName: "move_commentary",
      maxTokens: COMMENTATOR_MAX_TOKENS,
      ...commentaryPrompt(facts),
    });
    // Same ceiling as the LLM player: thinking and reasoning tokens count against it.
    expect(COMMENTATOR_MAX_TOKENS).toBe(LLM_PLAYER_MAX_TOKENS);

    const reply = JSON.stringify({
      summary: "Red played a move.",
      key_factors: [],
      caveat: "None.",
    });
    const anthropic = vi.fn<FetchLike>(async () => json(anthropicMessage(reply)));
    await callAnthropic(KEY, "claude-sonnet-5-5", req, { fetch: anthropic });
    const sent = JSON.parse(String(anthropic.mock.calls[0][1]?.body));
    expect(sent.max_tokens).toBe(COMMENTATOR_MAX_TOKENS);
    expect(sent.output_config.effort).toBe("low"); // Sonnet: keep thinking light
    expect(sent).not.toHaveProperty("thinking"); // adaptive by default; "disabled" is a 400 on Sonnet 5.5
    expect(sent).not.toHaveProperty("temperature"); // non-default sampling is a 400 on Sonnet 5.5

    const openai = vi.fn<FetchLike>(async () =>
      json({
        model: "gpt-5-mini",
        choices: [{ finish_reason: "stop", message: { content: reply } }],
      }),
    );
    await callOpenAI(KEY, "gpt-5-mini", req, { fetch: openai });
    const sentOpenAI = JSON.parse(String(openai.mock.calls[0][1]?.body));
    expect(sentOpenAI.max_completion_tokens).toBe(COMMENTATOR_MAX_TOKENS);
  });

  const strongest = [...facts.features_after_move].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  )[0];
  const direction =
    strongest.contribution > 0
      ? "favours_red"
      : strongest.contribution < 0
        ? "favours_blue"
        : "neutral";
  const faithful: Commentary = {
    summary: `Red played ${facts.chosen_move} after a depth ${facts.search.depth} search. ${strongest.label} contributed ${strongest.contribution}.`,
    key_factors: [
      {
        feature: strongest.feature,
        effect: direction,
        evidence: `contribution ${strongest.contribution}`,
      },
    ],
    caveat: "The facts do not say why the weights were chosen.",
  };

  it("passes a faithful explanation", () => {
    const result = groundingCheck(faithful, facts);
    expect(result.checks.map((c) => c.ok)).toEqual([true, true, true, true, true]);
    expect(result.passed).toBe(true);
    expect(result.checks[3].detail).toBe("Says Red made the move, as in the input.");
    expect(commentaryToText(faithful)).toContain(faithful.summary);
  });

  it("flags commentary that says the wrong player moved", () => {
    expect(facts.mover).toBe("Red");
    const wrong = groundingCheck(
      { ...faithful, summary: `Blue played ${facts.chosen_move} to slow Red down.` },
      facts,
    );
    expect(wrong.passed).toBe(false);
    expect(wrong.checks[3]).toMatchObject({
      ok: false,
      detail: "Says Blue made a move, but the mover in the input is Red.",
    });
    expect(
      groundingCheck({ ...faithful, caveat: "Blue has taken nothing yet." }, facts).passed,
    ).toBe(false);
    // Naming the other colour without saying it moved is fine.
    const mentions = groundingCheck(
      {
        ...faithful,
        summary: `Red chose ${facts.chosen_move}; it keeps Blue's tiles apart and blocks Blue.`,
      },
      facts,
    );
    expect(mentions.checks[3].ok).toBe(true);
    const silent = groundingCheck({ ...faithful, summary: "The move scored well." }, facts);
    expect(silent.checks[3]).toMatchObject({
      ok: true,
      detail: "Does not say which player moved.",
    });
  });

  it("flags a wrong direction, an invented number and an invented move", () => {
    const flipped = direction === "favours_red" ? "favours_blue" : "favours_red";
    const result = groundingCheck(
      {
        ...faithful,
        summary: `${faithful.summary} It also blocks (1, 1) and gains 987.6 points.`,
        key_factors: [{ ...faithful.key_factors[0], effect: flipped }],
      },
      facts,
    );
    expect(result.passed).toBe(false);
    expect(result.checks[0].ok).toBe(false);
    expect(result.checks[1].detail).toContain("987.6");
    expect(result.checks[2].detail).toContain("(1, 1)"); // occupied, so never a candidate
  });

  it("catches invented numbers that end a sentence, the summary or the caveat", () => {
    const endOfSummary = groundingCheck(
      { ...faithful, summary: `${faithful.summary} The evaluation total was 987.6.` },
      facts,
    );
    expect(endOfSummary.checks[1].ok).toBe(false);
    expect(endOfSummary.checks[1].detail).toContain("987.6");
    const endOfCaveat = groundingCheck(
      { ...faithful, caveat: "The facts cannot say why it beat more than 4321." },
      facts,
    );
    expect(endOfCaveat.passed).toBe(false);
    expect(endOfCaveat.checks[1].detail).toContain("4321");
  });

  it("says how the score relates to the features at each depth", () => {
    expect(facts.search.forced_win).toBeNull();
    expect(facts.score_scope).toContain("minimax value of a 2-ply search");
    expect(facts.score_scope).toContain("not the sum of the feature contributions");
    const shallow = chooseAgentAction(5, history, "red", { fixedDepth: 1 });
    if (shallow.explanation.kind !== "search") throw new Error("expected a search");
    const oneply = buildCommentaryFacts({
      n: 5,
      turn: 5,
      colour: "red",
      action: shallow.action,
      explanation: shallow.explanation,
    });
    expect(oneply.score_scope).toContain("the feature contributions add up to it");
    expect(Number(oneply.search.chosen_score)).toBeCloseTo(oneply.evaluation_total, 1);
    expect(commentaryPrompt(facts).system).toContain("Read score_scope first");
  });

  it("accepts neutral for the shared empty-hex feature, and rejects favours Blue", () => {
    const empty = facts.features_after_move.find((f) => f.feature === "empty")!;
    expect(empty.counts_for).toBe("both players (shared)");
    expect(empty.contribution).toBeGreaterThan(0);
    expect(empty.note).toContain("same for every candidate move");
    const cite = (effect: Commentary["key_factors"][number]["effect"]) =>
      groundingCheck(
        {
          ...faithful,
          key_factors: [
            { feature: "empty", effect, evidence: `contribution ${empty.contribution}` },
          ],
        },
        facts,
      ).checks[0].ok;
    expect(cite("neutral")).toBe(true);
    expect(cite("favours_red")).toBe(true); // the sign of its contribution, not wrong either
    expect(cite("favours_blue")).toBe(false);
  });

  it("flags a claimed forced win the search did not find, but not a denial", () => {
    const claimed = groundingCheck(
      { ...faithful, summary: `${faithful.summary} Red now has a forced win.` },
      facts,
    );
    expect(claimed.passed).toBe(false);
    expect(claimed.checks[4].detail).toBe("Claims a forced win, but the search did not find one.");
    const denied = groundingCheck(
      { ...faithful, caveat: "The search found no forced win for either side." },
      facts,
    );
    expect(denied.checks[4].ok).toBe(true);
  });

  // Regression (review of PR #12): 4 × 4, seed 76, the original agent as Red
  // against random. At depth 3 the search finds a forced win, while the
  // one-ply features of the position after the move favour Blue (total -12).
  // A reply explaining the move through the features alone used to pass.
  describe("a forced win at depth 3 whose features favour Blue", () => {
    const seed76: Action[] = [
      place(1, 1),
      STEAL,
      place(0, 3),
      place(3, 2),
      place(3, 1),
      place(3, 3),
      place(1, 0),
      place(1, 3),
      place(0, 0),
      place(2, 1),
      place(0, 1),
      place(0, 2),
      place(2, 2),
      place(1, 2),
      place(0, 3),
      place(2, 2),
      place(3, 2),
      place(2, 3),
      place(2, 0),
      place(2, 1),
    ];
    const d = chooseAgentAction(4, seed76, "red");
    if (d.explanation.kind !== "search") throw new Error("expected a search");
    const forced = buildCommentaryFacts({
      n: 4,
      turn: seed76.length + 1,
      colour: "red",
      action: d.action,
      explanation: d.explanation,
    });
    const triangle = forced.features_after_move.find((f) => f.feature === "triangle")!;
    const featuresOnly: Commentary = {
      summary: `Red played ${forced.chosen_move}. Triangle formations contributed ${triangle.contribution}, and the evaluation total was ${forced.evaluation_total}.`,
      key_factors: [
        { feature: "triangle", effect: "favours_blue", evidence: `${triangle.contribution}` },
      ],
      caveat: "The facts do not say why the weights were chosen.",
    };

    it("tells the model the score is a forced win, not the features", () => {
      expect(forced.search.depth).toBe(3);
      expect(forced.search.chosen_score).toBe("+infinity (forced win for Red)");
      expect(forced.search.forced_win).toBe("Red");
      expect(forced.evaluation_total).toBe(-12);
      expect(forced.score_scope).toContain("forced win for Red");
      expect(forced.score_scope).toContain("not the feature breakdown");
    });

    it("fails a reply that explains the move through the features alone", () => {
      const result = groundingCheck(featuresOnly, forced);
      expect(result.checks.slice(0, 4).every((c) => c.ok)).toBe(true); // the old checks pass
      expect(result.passed).toBe(false);
      expect(result.checks[4]).toMatchObject({
        label: "Forced wins reported as the search found them",
        ok: false,
      });
    });

    it("passes a reply that reports the forced win, and fails one that gives it to Blue", () => {
      const reported = {
        ...featuresOnly,
        summary: `Red played ${forced.chosen_move} because the 3-ply search found a forced win for Red. The features describe the position right after the move and point the other way.`,
      };
      expect(groundingCheck(reported, forced).passed).toBe(true);
      const wrongSide = groundingCheck(
        { ...reported, summary: `${reported.summary} Blue can force a win elsewhere.` },
        forced,
      );
      expect(wrongSide.checks[4].ok).toBe(false);
      expect(wrongSide.checks[4].detail).toContain("Gives the forced win to Blue");
    });

    it("re-checks logged entries, including ones logged before forced_win existed", () => {
      const oldSearch: Partial<typeof forced.search> = { ...forced.search };
      delete oldSearch.forced_win;
      const old = { ...forced, search: oldSearch } as typeof forced;
      expect(forcedWinner(old)).toBe("Red");
      const user = commentaryPrompt(old).user;
      expect(parseCommentaryFacts(user)?.chosen_move).toBe(forced.chosen_move);
      expect(recheckLoggedCommentary(user, featuresOnly)?.passed).toBe(false);
      expect(recheckLoggedCommentary("What is 2 + 2?", featuresOnly)).toBeNull();
      expect(recheckLoggedCommentary(user, { summary: 1 })).toBeNull();
    });
  });

  it("stores the check with the call, and exports it", async () => {
    const audit = new MemoryAuditStore();
    const reply = { ...faithful, summary: `Blue played ${facts.chosen_move}.` };
    const fetch = vi.fn(async () => json(anthropicMessage(JSON.stringify(reply))));
    const res = await callStructured(
      { provider: "anthropic", model: DEFAULT_ANTHROPIC_MODEL, apiKey: KEY },
      commentaryRequest(facts),
      { audit, fetch, check: (data) => groundingCheck(data, facts) },
    );
    expect(res.entry.grounding?.passed).toBe(false);
    const [entry] = await audit.list();
    expect(entry.grounding).toEqual(groundingCheck(reply, facts));
    await audit.update(entry.id, { humanDecision: "accepted" });
    const [accepted] = await audit.list();
    const [header, row] = auditToCsv([accepted]).split("\r\n");
    expect(header).toContain("grounding_passed,grounding_failures,human_decision");
    expect(row).toContain(`false,"The right player made the move: Says Blue made a move`);
    expect(row).toContain(",accepted,");
    expect(JSON.parse(auditToJson([accepted])).entries[0].grounding.passed).toBe(false);
    expect(JSON.stringify(accepted)).not.toContain(KEY);
  });

  it("extracts numbers at the end of sentences but not inside words", () => {
    expect(mentionedNumbers("...was 12.34. Red gains 7.5, Blue loses 99.")).toEqual([
      "12.34",
      "7.5",
      "99",
    ]);
    expect(mentionedNumbers("cell r2 or 3x; total -4.25")).toEqual(["-4.25"]);
  });
});

describe("LLM as a player", () => {
  it("prompts with the board and every legal move", () => {
    const { system, user } = buildMovePrompt(4, [place(1, 1)], "blue");
    expect(system).toContain("STEAL");
    expect(user).toContain("You are Blue");
    expect(user).toContain("Legal moves (16)");
    expect(user).toContain("STEAL");
    expect(user).not.toContain("(1, 1),"); // occupied cells are not offered
    const retry = buildMovePrompt(4, [place(1, 1)], "blue", "(1, 1) is already occupied.");
    expect(retry.user).toContain("previous answer was rejected");
  });

  it("validates answers against the referee", () => {
    const h = [place(1, 1)];
    const mv = (m: Partial<LlmMove>): LlmMove => ({
      action: "PLACE",
      r: 0,
      q: 0,
      reason: "",
      ...m,
    });
    expect(validateMove(4, h, mv({}))).toEqual({ ok: true, action: place(0, 0) });
    expect(validateMove(4, h, mv({ action: "STEAL" }))).toEqual({ ok: true, action: STEAL });
    expect(validateMove(4, [], mv({ action: "STEAL" })).ok).toBe(false);
    expect(validateMove(4, h, mv({ r: 1, q: 1 })).ok).toBe(false);
    expect(validateMove(4, h, mv({ r: 9, q: 0 })).ok).toBe(false);
    expect(validateMove(5, [], mv({ r: 2, q: 2 })).ok).toBe(false); // centre on move 1
  });

  it("schedules colour-balanced, colour-swapped pairs", () => {
    const s = scheduleGames(4, 1);
    expect(s.map((g) => g.llmColour)).toEqual(["red", "blue", "red", "blue"]);
    expect(s[0].seed).toBe(s[1].seed);
    expect(s[0].seed).not.toBe(s[2].seed);
  });

  const agentMove = async (history: readonly Action[], colour: "red" | "blue", seed: number) =>
    tournamentMove("minimax-dynamic", 4, history, colour, createRng(seed)).action;
  const firstLegal = async (prompt: {
    user: string;
  }): Promise<{
    move: LlmMove;
    latencyMs: number;
    usage: { inputTokens: number; outputTokens: number };
  }> => {
    const match = prompt.user.match(/Legal moves \(\d+\): \((\d+), (\d+)\)/);
    if (!match) throw new Error("no legal move found in prompt");
    return {
      move: { action: "PLACE", r: Number(match[1]), q: Number(match[2]), reason: "first" },
      latencyMs: 100,
      usage: { inputTokens: 500, outputTokens: 20 },
    };
  };

  it("plays a full game against the agent and records metrics", async () => {
    const [g] = scheduleGames(1, 3);
    const rec = await playLlmGame({ n: 4, game: g, askLlm: firstLegal, agentMove });
    expect(["win", "loss", "draw"]).toContain(rec.result);
    expect(rec.illegalAttempts).toBe(0);
    expect(rec.attempts).toBe(rec.llmMoves);
    expect(rec.llmTurns).toBe(rec.llmMoves);
    expect(rec.firstAnswerIllegal + rec.firstAnswerFormat).toBe(0);
    expect(rec.inputTokens).toBe(500 * rec.attempts);
    expect(Game.fromActions(4, rec.actions).over()).toBe(true);
  });

  it("re-asks after an illegal answer, then forfeits after three", async () => {
    const [g] = scheduleGames(1, 3);
    let calls = 0;
    const flaky = async (prompt: { user: string }) => {
      calls++;
      if (calls === 1)
        return {
          move: { action: "PLACE" as const, r: 9, q: 9, reason: "oops" },
          latencyMs: 50,
          usage: null,
        };
      return firstLegal(prompt);
    };
    const rec = await playLlmGame({ n: 4, game: g, askLlm: flaky, agentMove });
    expect(rec.illegalAttempts).toBe(1);
    expect(rec.firstAnswerIllegal).toBe(1);
    expect(rec.rejections[0]).toContain("outside the board");
    expect(rec.attempts).toBe(rec.llmMoves + 1);

    const malformed = async () => ({ move: null, latencyMs: 10, usage: null });
    const junk = await playLlmGame({ n: 4, game: g, askLlm: malformed, agentMove });
    expect(junk.rejections[0]).toContain("did not match the move format");
    expect(junk.result).toBe("forfeit");
    expect(junk).toMatchObject({
      illegalAttempts: 0,
      firstAnswerFormat: 1,
      formatFailures: { malformed: 3, truncated: 0, refusal: 0 },
    });

    // A cut-off reply is a format failure with its own reason, never an illegal move.
    let cut = 0;
    const cutOnce = async (prompt: { user: string }) =>
      cut++ === 0
        ? {
            move: null,
            failure: "truncated" as const,
            latencyMs: 10,
            usage: { inputTokens: 300, outputTokens: 4096 },
          }
        : firstLegal(prompt);
    const truncated = await playLlmGame({ n: 4, game: g, askLlm: cutOnce, agentMove });
    expect(truncated.rejections[0]).toContain("cut off");
    expect(truncated).toMatchObject({
      illegalAttempts: 0,
      firstAnswerIllegal: 0,
      firstAnswerFormat: 1,
      formatFailures: { malformed: 0, truncated: 1, refusal: 0 },
    });
    expect(truncated.outputTokens).toBeGreaterThanOrEqual(4096); // billed tokens still count

    const hopeless = async () => ({
      move: { action: "STEAL" as const, r: -1, q: -1, reason: "" },
      latencyMs: 10,
      usage: null,
    });
    const lost = await playLlmGame({ n: 4, game: g, askLlm: hopeless, agentMove });
    expect(lost).toMatchObject({
      result: "forfeit",
      winner: "blue",
      attempts: 3,
      illegalAttempts: 3,
      llmMoves: 0,
    });

    const summary = summariseLlmGames([rec, lost]);
    expect(summary.games).toBe(2);
    expect(summary.forfeits).toBe(1);
    expect(summary.forfeitRate).toMatchObject({ successes: 1, n: 2 });
    // Per turn, not per answer: the forfeited turn counts once, not three times.
    expect(summary.turns).toBe(rec.llmTurns + 1);
    expect(summary.firstAnswerRejected.successes).toBe(2);
    expect(summary.firstAnswerRejected.n).toBe(rec.llmTurns + 1);
    expect(summary.firstAnswerRejected.clusters).toBe(2);
    expect(summary.illegalAttempts).toBe(4);
    expect(summary.attempts).toBe(rec.attempts + 3);
    const rows = llmGamesCsvRows([rec, lost]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ llm_turns: 1, first_answer_illegal: 1, illegal_answers: 3 });
  });

  it("widens the rejected-answer interval when rejections bunch within games", () => {
    const game = (index: number, llmTurns: number, rejected: number): LlmGameRecord => ({
      index,
      llmColour: index % 2 ? "blue" : "red",
      seed: index,
      n: 4,
      result: "loss",
      winner: index % 2 ? "red" : "blue",
      turns: llmTurns * 2,
      actions: [],
      llmMoves: llmTurns,
      llmTurns,
      firstAnswerIllegal: rejected,
      firstAnswerFormat: 0,
      attempts: llmTurns + rejected,
      illegalAttempts: rejected,
      formatFailures: { malformed: 0, truncated: 0, refusal: 0 },
      rejections: [],
      latencyMs: [100],
      inputTokens: 0,
      outputTokens: 0,
      usageReported: false,
    });
    // Rejections bunched in two of four games: 12 of 24 turns.
    const games = [game(0, 6, 6), game(1, 6, 0), game(2, 6, 6), game(3, 6, 0)];
    const r = summariseLlmGames(games).firstAnswerRejected;
    expect(r).toMatchObject({ successes: 12, n: 24, clusters: 4, p: 0.5 });
    // Clustering widens the interval well beyond a Wilson interval over 24 "independent"
    // turns: design effect 8, so 3 effective turns (statsmodels reference in stats.test.ts).
    const naive = wilson(12, 24);
    expect(r.designEffect).toBeCloseTo(8, 9);
    expect(r.upper - r.lower).toBeGreaterThan(2 * (naive.upper - naive.lower));
    // Spread evenly, the games say the same as independent turns.
    const even = summariseLlmGames([game(0, 6, 3), game(1, 6, 3), game(2, 6, 3), game(3, 6, 3)]);
    expect(even.firstAnswerRejected.lower).toBeCloseTo(naive.lower, 12);
    const one = summariseLlmGames([game(0, 6, 3)]).firstAnswerRejected;
    expect(one.p).toBe(0.5);
    expect(Number.isNaN(one.designEffect)).toBe(true); // one game: cannot be estimated
  });

  it("pairs the model with each baseline game by game", () => {
    const records = [
      { index: 0, result: "win" as const },
      { index: 1, result: "loss" as const },
      { index: 2, result: "win" as const },
      { index: 3, result: "draw" as const },
    ];
    const baseline = {
      outcomes: [
        { index: 0, won: true },
        { index: 1, won: true },
        { index: 2, won: false },
        { index: 3, won: true },
        { index: 4, won: true }, // not played by the model: ignored
      ],
    };
    const p = pairWithLlm(records, baseline)!;
    expect(p).toMatchObject({ games: 4, llmOnly: 1, baselineOnly: 2 });
    expect(p.mcnemar.pValue).toBe(1); // 1 vs 2 discordant games: binom.test(1, 3) in R
    expect(pairWithLlm(records, { outcomes: [] })).toBeNull();
    const s = scheduleGames(2, 9);
    const random = summariseBaseline(4, s, "random")!;
    expect(random.outcomes.map((o) => o.index)).toEqual([0, 1]);
    expect(random.outcomes.filter((o) => o.won)).toHaveLength(random.wins.successes);
  });

  it("legal moves include STEAL only on Blue's first move", () => {
    expect(legalMoves(Game.fromActions(4, [place(0, 0)])).some((a) => a[0] === "STEAL")).toBe(true);
    expect(legalMoves(Game.fromActions(4, [])).some((a) => a[0] === "STEAL")).toBe(false);
  });

  it("replays the same schedule with a baseline agent in the model's seat", () => {
    const s = scheduleGames(2, 9);
    const a = s.map((g) => playBaselineGame(4, g, "random"));
    const b = s.map((g) => playBaselineGame(4, g, "random"));
    expect(a).toEqual(b);
  });

  it("compares a stopped run with the baselines on the finished games only", () => {
    const s = scheduleGames(4, 2026);
    // The model finished game 1 of 4, then the run was stopped.
    const played = completedSchedule(s, [{ index: 0 }]);
    expect(played).toEqual([s[0]]);
    const random = summariseBaseline(4, played, "random")!;
    expect(random.games).toBe(1);
    expect(random.wins.n).toBe(1);
    expect(random.asRed).toBe(1); // one game, so colours are unbalanced
    expect(summariseBaseline(4, completedSchedule(s, []), "greedy")).toBeNull();
    expect(summariseBaseline(4, completedSchedule(s, s), "greedy")!.games).toBe(4);
  });

  it("the scripted first-legal-cell line beats the agent as Blue (agent card failure mode)", () => {
    // The agent searches one ply and never checks the opponent's next move,
    // so it does not block Blue filling row 0. Seeds 0 to 49 per board size.
    const winsAs = (n: number, colour: "red" | "blue") =>
      Array.from({ length: 50 }, (_, seed) =>
        playBaselineGame(n, { index: seed, llmColour: colour, seed }, "first-legal"),
      ).filter((g) => g.won).length;
    expect(winsAs(4, "blue")).toBe(50);
    expect(winsAs(5, "blue")).toBe(43);
    expect(winsAs(6, "blue")).toBe(34);
    expect(winsAs(4, "red")).toBe(0);
    expect(firstLegalAction(4, [place(0, 0)])).toEqual(place(0, 1));
  });

  it("in almost every such loss the agent left a blockable one-move win open", () => {
    const blueWinsNext = (n: number, h: readonly Action[]) =>
      Game.fromActions(n, h)
        .legalPlacements()
        .some(([r, q]) => {
          const g = Game.fromActions(n, [...h, place(r, q)]);
          return g.result?.kind === "win" && g.result.winner === "blue";
        });
    const counts = [4, 5, 6].map((n) => {
      let losses = 0;
      let blockable = 0;
      for (let seed = 0; seed < 50; seed++) {
        const g = new Game(n);
        const h: Action[] = [];
        let missed = false;
        while (!g.over()) {
          const colour = g.turnPlayer();
          const a =
            colour === "blue"
              ? firstLegalAction(n, h)
              : tournamentMove(
                  "minimax-dynamic",
                  n,
                  h,
                  colour,
                  createRng(deriveSeed(seed, h.length)),
                ).action;
          if (colour === "red" && !Game.fromActions(n, [...h, a]).over()) {
            const leftOpen = blueWinsNext(n, [...h, a]);
            const couldBlock = Game.fromActions(n, h)
              .legalPlacements()
              .some(([r, q]) => {
                const after = [...h, place(r, q)];
                return Game.fromActions(n, after).over() || !blueWinsNext(n, after);
              });
            if (leftOpen && couldBlock) missed = true;
          }
          g.update(colour, a);
          h.push(a);
        }
        if (g.result?.kind === "win" && g.result.winner === "blue") {
          losses++;
          if (missed) blockable++;
        }
      }
      return [losses, blockable];
    });
    expect(counts).toEqual([
      [50, 50],
      [43, 41],
      [34, 33],
    ]);
  });

  it("draws the board with neighbours symmetric below each cell", () => {
    const board = renderBoard(Game.fromActions(4, [place(1, 1), place(0, 3), place(3, 0)]));
    expect(board).toBe(
      ["q:   0 1 2 3", "r0   . . . B", "r1    . R . .", "r2     . . . .", "r3      R . . ."].join(
        "\n",
      ),
    );
    // (1, 1) sits half a cell right of (0, 1) and half a cell left of (0, 2).
    const lines = board.split("\n");
    const col = (r: number, q: number) => 5 + r + 2 * q;
    expect(lines[2][col(1, 1)]).toBe("R");
    expect(lines[1][col(0, 3)]).toBe("B");
    expect(col(0, 1) + 1).toBe(col(1, 1));
    expect(col(0, 2) - 1).toBe(col(1, 1));
  });
});
