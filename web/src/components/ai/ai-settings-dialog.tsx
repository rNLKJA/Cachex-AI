"use client";

import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Segmented } from "@/components/play/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ANTHROPIC_MODELS, DEFAULT_OPENAI_MODEL } from "@/lib/ai/models";
import { PROVIDERS, initialRemember, maskKey, planSettingsSave } from "@/lib/ai/settings";
import { PROVIDER_LABEL, type Provider } from "@/lib/ai/types";
import { useAi } from "./ai-provider";

export function AiSettingsDialog({
  onCloseAutoFocus,
}: {
  /** Returns focus to whatever opened the dialog. */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { settingsOpen, setSettingsOpen } = useAi();
  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {/* Remount the form each time the dialog opens so it starts from saved state. */}
        {settingsOpen && <SettingsForm onDone={() => setSettingsOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const { prefs, setPrefs, savedKeys, saveApiKey, forgetApiKeys } = useAi();
  // A draft of every setting: nothing is written until Save, so closing the
  // dialog (Escape, the close button, clicking outside) changes nothing.
  const [provider, setDraftProvider] = useState<Provider>(prefs.provider);
  const [anthropicModel, setAnthropicModel] = useState(prefs.anthropicModel);
  const [openaiModel, setOpenaiModel] = useState(prefs.openaiModel);
  const [draftKey, setDraftKey] = useState("");
  const [remember, setRemember] = useState(() => initialRemember(prefs.provider, savedKeys));
  const [rememberTouched, setRememberTouched] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const storedKey = savedKeys[provider] ?? null;
  const otherSaved = PROVIDERS.filter((p) => p !== provider && savedKeys[p]);
  const anySaved = Object.keys(savedKeys).length > 0;

  const setProvider = (next: Provider) => {
    setDraftProvider(next);
    setDraftKey("");
    // The box describes the selected provider's key, so it follows the switch.
    setRemember(initialRemember(next, savedKeys));
    setRememberTouched(false);
  };

  const save = () => {
    const plan = planSettingsSave(
      { provider, anthropicModel, openaiModel, key: draftKey, remember, rememberTouched },
      savedKeys,
    );
    setPrefs(plan.prefs);
    if (plan.key) saveApiKey(plan.key.provider, plan.key.key, plan.key.remember);
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="text-gold size-5" /> AI settings
        </DialogTitle>
        <DialogDescription>
          Optional. Everything on this site works without a key. With your own key you can turn on
          the move commentator and the LLM-as-a-player evaluation.
        </DialogDescription>
      </DialogHeader>

      <div className="bg-muted/50 flex gap-2.5 rounded-xl border p-3 text-xs leading-relaxed">
        <ShieldCheck className="text-gold-ink mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Your key stays in this browser. Requests go{" "}
          <strong>directly from your browser to {PROVIDER_LABEL[provider]}</strong>; this site has
          no server that could see the key, and it is never logged or written to the AI audit log.
          Calls are billed to your account by the provider.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Provider
          </span>
          <Segmented
            label="AI provider"
            value={provider}
            onChange={setProvider}
            options={[
              { value: "anthropic", label: "Anthropic (default)" },
              { value: "openai", label: "OpenAI" },
            ]}
          />
        </div>

        {provider === "anthropic" ? (
          <div className="space-y-1.5">
            <Label htmlFor="ai-model" className="text-muted-foreground text-xs uppercase">
              Model
            </Label>
            <Select value={anthropicModel} onValueChange={setAnthropicModel}>
              <SelectTrigger id="ai-model" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANTHROPIC_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="ai-openai-model" className="text-muted-foreground text-xs uppercase">
              Model id
            </Label>
            <Input
              id="ai-openai-model"
              value={openaiModel}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setOpenaiModel(e.target.value)}
              placeholder={DEFAULT_OPENAI_MODEL}
            />
            <p className="text-muted-foreground text-xs">
              Any Chat Completions model that supports JSON-schema output.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="ai-key" className="text-muted-foreground text-xs uppercase">
            {PROVIDER_LABEL[provider]} API key
          </Label>
          <div className="flex gap-2">
            <Input
              id="ai-key"
              type={showKey ? "text" : "password"}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder={storedKey ? `Saved: ${maskKey(storedKey.key)}` : "Paste your key"}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="ai-key-status"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <p id="ai-key-status" className="text-muted-foreground text-xs" aria-live="polite">
            {storedKey
              ? storedKey.remembered
                ? `A key (${maskKey(storedKey.key)}) is remembered on this device.`
                : `A key (${maskKey(storedKey.key)}) is saved for this tab only.`
              : `No ${PROVIDER_LABEL[provider]} key saved.`}
            {otherSaved.map((p) => (
              <span key={p} className="block">
                {PROVIDER_LABEL[p]}: a key ({maskKey(savedKeys[p]!.key)}) is also{" "}
                {savedKeys[p]!.remembered ? "remembered on this device" : "saved for this tab"}.
              </span>
            ))}
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="ai-remember"
            checked={remember}
            onCheckedChange={(v) => {
              setRemember(v === true);
              setRememberTouched(true);
            }}
            className="mt-0.5"
          />
          <Label htmlFor="ai-remember" className="block text-sm leading-snug font-normal">
            Remember on this device
            <span className="text-muted-foreground block text-xs">
              Off: kept in session storage and cleared when the tab closes. On: kept in local
              storage until you forget it.
            </span>
          </Label>
        </div>
      </div>

      <DialogFooter className="items-stretch sm:items-center">
        {anySaved && (
          <Button
            variant="destructive"
            onClick={() => {
              forgetApiKeys();
              setDraftKey("");
              setRemember(false);
              setRememberTouched(false);
            }}
            className="sm:mr-auto"
          >
            <Trash2 /> {Object.keys(savedKeys).length > 1 ? "Forget all keys" : "Forget key"}
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/ai-log" onClick={onDone}>
            View AI audit log
          </Link>
        </Button>
        <Button onClick={save}>Save</Button>
      </DialogFooter>
      <p className="text-muted-foreground -mt-1 text-xs">
        What the AI features do and never do:{" "}
        <Link href="/methods#ai-use" onClick={onDone} className="underline underline-offset-4">
          AI use statement
        </Link>
        .
      </p>
    </>
  );
}
