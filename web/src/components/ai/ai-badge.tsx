import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/** Visible label on every piece of model output. */
export function AiBadge({ model, className }: { model?: string; className?: string }) {
  return (
    <span
      className={cn(
        "border-gold/40 bg-gold/10 text-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
        className,
      )}
    >
      <Sparkles className="text-gold-ink size-3" aria-hidden />
      AI-generated
      {model && <span className="text-muted-foreground font-mono font-normal">· {model}</span>}
    </span>
  );
}
