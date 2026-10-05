import { CircleAlert, CircleCheck } from "lucide-react";

import type { AuditGrounding } from "@/lib/ai/audit-log";
import { cn } from "@/lib/utils";

/**
 * The automated grounding check for one AI output. Open by default when a
 * check failed, so a reviewer sees the problem before deciding.
 */
export function GroundingDetails({
  grounding,
  note,
  className,
}: {
  grounding: AuditGrounding;
  /** Extra context, e.g. that the check was recomputed rather than stored. */
  note?: string;
  className?: string;
}) {
  return (
    <details className={cn("text-xs", className)} open={!grounding.passed}>
      <summary
        className={cn(
          "flex cursor-pointer items-center gap-1.5 font-medium",
          grounding.passed ? "text-foreground" : "text-destructive",
        )}
      >
        {grounding.passed ? (
          <CircleCheck className="text-gold-ink size-3.5" aria-hidden />
        ) : (
          <CircleAlert className="size-3.5" aria-hidden />
        )}
        Grounding check {grounding.passed ? "passed" : "found problems"}
      </summary>
      <ul className="text-muted-foreground mt-1.5 space-y-1 pl-5">
        {grounding.checks.map((c) => (
          <li key={c.label} className="list-disc">
            <span className={c.ok ? "text-foreground" : "text-destructive"}>{c.label}:</span>{" "}
            {c.detail}
          </li>
        ))}
      </ul>
      {note && <p className="text-muted-foreground mt-1.5 pl-5">{note}</p>}
    </details>
  );
}
