/**
 * Anthropic adapter: the official SDK, called straight from the browser.
 *
 * `dangerouslyAllowBrowser` makes the SDK send the
 * `anthropic-dangerous-direct-browser-access: true` header that Anthropic
 * requires for CORS. That is appropriate here because the key belongs to the
 * visitor and never leaves their machine except to api.anthropic.com.
 * Structured output uses `output_config.format` (JSON schema from zod) and
 * `messages.parse`, which validates the reply against the same schema.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { supportsEffort } from "./models";
import { AiError, type FetchLike, type StructuredRequest, type StructuredResponse } from "./types";

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
  let message;
  try {
    message = await client.messages.parse(
      {
        model,
        max_tokens: req.maxTokens ?? 2048,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: {
          format: zodOutputFormat(req.schema),
          // Short, factual tasks: keep Sonnet's thinking light. Haiku 4.5 takes no effort.
          ...(supportsEffort(model) ? { effort: "low" as const } : {}),
        },
      },
      { signal },
    );
  } catch (err) {
    throw toAiError(err);
  }

  if (message.stop_reason === "refusal") throw new AiError("refusal");
  if (message.stop_reason === "max_tokens") throw new AiError("truncated");
  const rawText = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const data = message.parsed_output;
  if (data === null || data === undefined) throw new AiError("invalid-output", "no parsed output");
  return {
    data: data as T,
    rawText,
    model: message.model,
    usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
  };
}
