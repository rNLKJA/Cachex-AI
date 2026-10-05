/**
 * Model choices. Claude model ids come from Anthropic's current model list
 * (checked October 2026); the cheap Haiku tier is the default because the AI
 * features are optional extras paid for with the visitor's own key.
 * The OpenAI model id is free text so visitors can use whatever their key has.
 */
import type { Provider } from "./types";

export const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (default, lowest cost)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (stronger, higher cost)" },
] as const;

export const DEFAULT_ANTHROPIC_MODEL = ANTHROPIC_MODELS[0].id;
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: DEFAULT_ANTHROPIC_MODEL,
  openai: DEFAULT_OPENAI_MODEL,
};

/** Sonnet-tier Claude models accept an effort setting; Haiku 4.5 does not. */
export const supportsEffort = (model: string) => model.startsWith("claude-sonnet-5");
