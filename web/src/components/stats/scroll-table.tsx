import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A table that scrolls sideways on narrow screens, with its caption kept
 * outside the scroll area so it always wraps to the viewport.
 */
export function ScrollTable({
  caption,
  className,
  children,
}: {
  caption?: ReactNode;
  /** Classes for the <table> (e.g. a min-width). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className="min-w-0">
      {caption && <figcaption className="text-muted-foreground mb-2 text-xs">{caption}</figcaption>}
      <div className="relative overflow-x-auto">
        <table className={cn("w-full text-sm", className)}>{children}</table>
      </div>
    </figure>
  );
}
