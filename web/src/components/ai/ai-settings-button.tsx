"use client";

import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAi } from "./ai-provider";

export function AiSettingsButton() {
  const { openSettings, storedKey, ready } = useAi();
  const active = ready && storedKey !== null;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openSettings}
      aria-label={active ? "AI settings (your key is set)" : "AI settings (bring your own key)"}
      title="AI settings"
      className="relative"
    >
      <KeyRound className="size-4" />
      {active && (
        <span
          aria-hidden
          className="bg-gold ring-background absolute top-1.5 right-1.5 size-2 rounded-full ring-2"
        />
      )}
    </Button>
  );
}
