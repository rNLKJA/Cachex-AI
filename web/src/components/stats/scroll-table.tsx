"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A container that scrolls sideways on narrow screens. It is focusable and
 * named, so keyboard users can scroll it too (WCAG 2.1.1; axe
 * `scrollable-region-focusable`). While more content is hidden to the right,
 * the right edge fades out, so a cut-off column (often the interval) reads as
 * "scroll for more" even where scrollbars are hidden (iOS). The fade is
 * dropped while the region has keyboard focus, so the focus ring stays whole.
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
  const ref = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setMoreRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    // Fires once on observe, then whenever the region or its content resizes.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="region"
      tabIndex={0}
      aria-label={labelledBy ? undefined : (label ?? "Scrollable table")}
      aria-labelledby={labelledBy}
      data-more-right={moreRight || undefined}
      className={cn(
        "focus-visible:ring-ring/50 relative overflow-x-auto rounded-sm outline-none focus-visible:ring-3",
        moreRight &&
          "[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)] focus-visible:[mask-image:none]",
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
