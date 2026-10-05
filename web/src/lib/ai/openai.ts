/**
 * OpenAI adapter: Chat Completions with a strict JSON-schema response format,
 * called straight from the browser with the visitor's own key. The reply is
 * validated with the same zod schema used for Anthropic.
 */
import { z } from "zod";

import { AiError, type FetchLike, type StructuredRequest, type StructuredResponse } from "./types";

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

type JsonSchema = { [key: string]: unknown };

/**
 * OpenAI's strict mode needs every object to list all of its properties as
 * required and to forbid additional ones.
 */
export function strictJsonSchema(schema: JsonSchema): JsonSchema {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (node === null || typeof node !== "object") return node;
    const out: JsonSchema = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema") continue;
      out[k] = visit(v);
    }
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.required = Object.keys(out.properties as object);
      out.additionalProperties = false;
    }
    return out;
  };
  return visit(schema) as JsonSchema;
}

interface ChatCompletion {
  model?: string;
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string; type?: string };
}

export async function callOpenAI<T>(
  apiKey: string,
  model: string,
  req: StructuredRequest<T>,
  {
    fetch: fetchImpl = globalThis.fetch.bind(globalThis),
    signal,
  }: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<StructuredResponse<T>> {
  const body = {
    model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: req.schemaName,
        strict: true,
        schema: strictJsonSchema(z.toJSONSchema(req.schema) as JsonSchema),
      },
    },
  };

  let res: Response;
  try {
    res = await fetchImpl(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new AiError("aborted");
    // fetch rejects with a TypeError for offline, DNS and CORS failures alike.
    throw new AiError("network", err instanceof Error ? err.message : String(err));
  }

  let json: ChatCompletion = {};
  try {
    json = (await res.json()) as ChatCompletion;
  } catch {
    if (res.ok) throw new AiError("invalid-output", "response was not JSON");
  }

  if (!res.ok) {
    const detail = json.error?.message;
    if (res.status === 401) throw new AiError("invalid-key", undefined, 401);
    if (res.status === 403) throw new AiError("permission", detail, 403);
    if (res.status === 429) throw new AiError("rate-limit", json.error?.code ?? undefined, 429);
    if (res.status === 400 || res.status === 404)
      throw new AiError("bad-request", detail, res.status);
    if (res.status === 503) throw new AiError("overloaded", undefined, 503);
    throw new AiError("server", detail, res.status);
  }

  const choice = json.choices?.[0];
  if (choice?.message?.refusal) throw new AiError("refusal", choice.message.refusal);
  if (choice?.finish_reason === "length") throw new AiError("truncated");
  const rawText = choice?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new AiError("invalid-output", "reply was not valid JSON");
  }
  const result = req.schema.safeParse(parsed);
  if (!result.success) {
    throw new AiError("invalid-output", result.error.issues[0]?.message ?? "schema mismatch");
  }
  return {
    data: result.data,
    rawText,
    model: json.model ?? model,
    usage: json.usage
      ? {
          inputTokens: json.usage.prompt_tokens ?? 0,
          outputTokens: json.usage.completion_tokens ?? 0,
        }
      : null,
  };
}
