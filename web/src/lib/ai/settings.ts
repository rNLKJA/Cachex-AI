/**
 * Where the visitor's AI settings live.
 *
 *  - Preferences (provider, model ids) are not secret: localStorage.
 *  - The API key, one per provider, goes to sessionStorage by default, so it
 *    is gone when the tab closes. Only if the visitor ticks "remember on this
 *    device" is it written to localStorage instead. "Forget key" removes it
 *    from both.
 *
 * Storage is injected so this module is testable and safe during SSR.
 */
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_OPENAI_MODEL } from "./models";
import type { Provider } from "./types";

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface AiPrefs {
  provider: Provider;
  anthropicModel: string;
  openaiModel: string;
}

export const DEFAULT_PREFS: AiPrefs = {
  provider: "anthropic",
  anthropicModel: DEFAULT_ANTHROPIC_MODEL,
  openaiModel: DEFAULT_OPENAI_MODEL,
};

const PREFS_KEY = "cachex-arena.ai.prefs";
const keyName = (provider: Provider) => `cachex-arena.ai.key.${provider}`;

export function loadPrefs(local: KV | null): AiPrefs {
  try {
    const raw = local?.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AiPrefs>;
    return {
      provider: parsed.provider === "openai" ? "openai" : "anthropic",
      anthropicModel:
        typeof parsed.anthropicModel === "string" && parsed.anthropicModel
          ? parsed.anthropicModel
          : DEFAULT_PREFS.anthropicModel,
      openaiModel:
        typeof parsed.openaiModel === "string" && parsed.openaiModel.trim()
          ? parsed.openaiModel.trim()
          : DEFAULT_PREFS.openaiModel,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(local: KV | null, prefs: AiPrefs): void {
  local?.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export interface StoredKey {
  key: string;
  /** True when the key is in localStorage ("remember on this device"). */
  remembered: boolean;
}

export function loadKey(
  provider: Provider,
  session: KV | null,
  local: KV | null,
): StoredKey | null {
  const s = session?.getItem(keyName(provider));
  if (s) return { key: s, remembered: false };
  const l = local?.getItem(keyName(provider));
  if (l) return { key: l, remembered: true };
  return null;
}

export function saveKey(
  provider: Provider,
  key: string,
  remember: boolean,
  session: KV | null,
  local: KV | null,
): void {
  const trimmed = key.trim();
  if (!trimmed) {
    forgetKey(provider, session, local);
    return;
  }
  if (remember) {
    local?.setItem(keyName(provider), trimmed);
    session?.removeItem(keyName(provider));
  } else {
    session?.setItem(keyName(provider), trimmed);
    local?.removeItem(keyName(provider));
  }
}

export function forgetKey(provider: Provider, session: KV | null, local: KV | null): void {
  session?.removeItem(keyName(provider));
  local?.removeItem(keyName(provider));
}

/** "sk-ant-…a1b2": enough to recognise a key without displaying it. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 10) return "•".repeat(k.length);
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}
