import { type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";

/**
 * A container that scrolls sideways on narrow screens. It is focusable and
 * named, so keyboard users can scroll it too (WCAG 2.1.1; axe
 * `scrollable-region-focusable`).
 */
export function ScrollRegion({
  label,
  labelledBy,
  className,
  children,
}: {
  /** Accessible name, when there is no visible caption to point at. */
  label?: string;
  /** Id of a visible caption that names the region. */
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={labelledBy ? undefined : (label ?? "Scrollable table")}
      aria-labelledby={labelledBy}
      className={cn(
        "focus-visible:ring-ring/50 relative overflow-x-auto rounded-sm outline-none focus-visible:ring-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A table that scrolls sideways on narrow screens, with its caption kept
 * outside the scroll area so it always wraps to the viewport.
 */
export function ScrollTable({
  caption,
  label,
  className,
  children,
}: {
  caption?: ReactNode;
  /** Accessible name for the scroll region when there is no caption. */
  label?: string;
  /** Classes for the <table> (e.g. a min-width). */
  className?: string;
  children: ReactNode;
}) {
  const captionId = useId();
  return (
    <figure className="min-w-0">
      {caption && (
        <figcaption id={captionId} className="text-muted-foreground mb-2 text-xs">
          {caption}
        </figcaption>
      )}
      <ScrollRegion labelledBy={caption ? captionId : undefined} label={label}>
        <table className={cn("w-full text-sm", className)}>{children}</table>
      </ScrollRegion>
    </figure>
  );
}
