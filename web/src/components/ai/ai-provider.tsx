"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { type AuditStore, getAuditStore } from "@/lib/ai/audit-log";
import {
  type AiPrefs,
  DEFAULT_PREFS,
  type StoredKey,
  forgetKey,
  loadKey,
  loadPrefs,
  saveKey,
  savePrefs,
} from "@/lib/ai/settings";
import type { Credentials } from "@/lib/ai/types";
import { AiSettingsDialog } from "./ai-settings-dialog";

/*
 * Browser storage as an external store, so components re-render when the
 * settings change (in this tab or another) without effects or hydration
 * mismatches: the server snapshot is "not loaded yet".
 */
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  for (const l of listeners) l();
};
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => emit();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
const getSnapshot = () => version;
const getServerSnapshot = () => -1;

const storages = () => ({
  session: typeof sessionStorage === "undefined" ? null : sessionStorage,
  local: typeof localStorage === "undefined" ? null : localStorage,
});

interface AiContextValue {
  /** False until browser storage has been read (always false on the server). */
  ready: boolean;
  prefs: AiPrefs;
  setPrefs: (prefs: AiPrefs) => void;
  /** The stored key for the selected provider, if any. */
  storedKey: StoredKey | null;
  saveApiKey: (key: string, remember: boolean) => void;
  forgetApiKey: () => void;
  /** Ready-to-use credentials, or null when no key is set. */
  credentials: Credentials | null;
  audit: AuditStore;
  settingsOpen: boolean;
  openSettings: () => void;
  setSettingsOpen: (open: boolean) => void;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = snapshot >= 0;
  const [settingsOpen, setSettingsOpen] = useState(false);

  const prefs = useMemo(
    () => (snapshot >= 0 ? loadPrefs(storages().local) : DEFAULT_PREFS),
    [snapshot],
  );
  const storedKey = useMemo(() => {
    if (snapshot < 0) return null;
    const { session, local } = storages();
    return loadKey(prefs.provider, session, local);
  }, [snapshot, prefs.provider]);

  const setPrefs = useCallback((next: AiPrefs) => {
    savePrefs(storages().local, next);
    emit();
  }, []);
  const saveApiKey = useCallback(
    (key: string, remember: boolean) => {
      const { session, local } = storages();
      saveKey(prefs.provider, key, remember, session, local);
      emit();
    },
    [prefs.provider],
  );
  const forgetApiKey = useCallback(() => {
    const { session, local } = storages();
    forgetKey(prefs.provider, session, local);
    emit();
  }, [prefs.provider]);

  const credentials = useMemo<Credentials | null>(
    () =>
      storedKey
        ? {
            provider: prefs.provider,
            model: prefs.provider === "anthropic" ? prefs.anthropicModel : prefs.openaiModel,
            apiKey: storedKey.key,
          }
        : null,
    [prefs, storedKey],
  );

  const audit = useMemo(() => getAuditStore(), []);

  const value: AiContextValue = {
    ready,
    prefs,
    setPrefs,
    storedKey,
    saveApiKey,
    forgetApiKey,
    credentials,
    audit,
    settingsOpen,
    openSettings: () => setSettingsOpen(true),
    setSettingsOpen,
  };

  return (
    <AiContext.Provider value={value}>
      {children}
      <AiSettingsDialog />
    </AiContext.Provider>
  );
}

export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used inside <AiProvider>");
  return ctx;
}
