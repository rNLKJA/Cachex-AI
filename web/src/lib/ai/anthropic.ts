/**
 * Anthropic adapter: the official SDK, called straight from the browser.
 *
 * `dangerouslyAllowBrowser` makes the SDK send the
 * `anthropic-dangerous-direct-browser-access: true` header that Anthropic
 * requires for CORS. That is appropriate here because the key belongs to the
 * visitor and never leaves their machine except to api.anthropic.com.
 *
 * Structured output uses `output_config.format` with a JSON schema built from
 * the zod schema (enums kept, see ./schema). The reply is handled in a fixed
 * order: first why the model stopped (a refusal or a reply cut off at
 * `max_tokens` is reported as such, not as a format error), then JSON
 * parsing, then zod validation. Every failure carries the raw text and token
 * usage so the audit log can show what came back and what it cost.
 */
import Anthropic from "@anthropic-ai/sdk";
import { supportsEffort } from "./models";
import { anthropicJsonSchema, parseStructured } from "./schema";
import {
  AiError,
  type FetchLike,
  type StructuredRequest,
  type StructuredResponse,
  type TokenUsage,
} from "./types";

export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  // Most specific first: APIConnectionError and the status errors all extend APIError.
  if (err instanceof Anthropic.APIUserAbortError) return new AiError("aborted");
  if (err instanceof Anthropic.APIConnectionError) return new AiError("network", err.message);
  if (err instanceof Anthropic.AuthenticationError)
    return new AiError("invalid-key", undefined, 401);
  if (err instanceof Anthropic.PermissionDeniedError)
    return new AiError("permission", err.message, 403);
  if (err instanceof Anthropic.RateLimitError) return new AiError("rate-limit", undefined, 429);
  if (err instanceof Anthropic.BadRequestError) return new AiError("bad-request", err.message, 400);
  if (err instanceof Anthropic.NotFoundError) return new AiError("bad-request", err.message, 404);
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return new AiError("overloaded", undefined, 529);
    return new AiError("server", err.message, err.status);
  }
  if (err instanceof Anthropic.AnthropicError) return new AiError("invalid-output", err.message);
  if (err instanceof DOMException && err.name === "AbortError") return new AiError("aborted");
  return new AiError("network", err instanceof Error ? err.message : String(err));
}

export async function callAnthropic<T>(
  apiKey: string,
  model: string,
  req: StructuredRequest<T>,
  { fetch, signal }: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<StructuredResponse<T>> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
    timeout: 90_000,
    ...(fetch ? { fetch } : {}),
  });
  let message: Anthropic.Message;
  try {
    message = await client.messages.create(
      {
        model,
        max_tokens: req.maxTokens ?? 2048,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: {
          format: { type: "json_schema", schema: anthropicJsonSchema(req.schema) },
          // Short, factual tasks: keep Sonnet's thinking light. Haiku 4.5 takes no effort.
          ...(supportsEffort(model) ? { effort: "low" as const } : {}),
        },
      },
      { signal },
    );
  } catch (err) {
    throw toAiError(err);
  }

  const rawText = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const usage: TokenUsage = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
  const evidence = { rawText, usage };
  // Why the model stopped comes first: neither a refusal nor a reply cut off
  // at max_tokens has to match the schema, and neither is a format mistake.
  if (message.stop_reason === "refusal") {
    throw new AiError(
      "refusal",
      message.stop_details?.explanation ?? message.stop_details?.category ?? undefined,
      undefined,
      evidence,
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new AiError("truncated", `limit ${req.maxTokens ?? 2048} tokens`, undefined, evidence);
  }
  const data = parseStructured(req.schema, rawText, evidence);
  return { data, rawText, model: message.model, usage };
}
