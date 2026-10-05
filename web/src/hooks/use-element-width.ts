"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Tracks an element's content-box width with a ResizeObserver, so SVG charts
 * can be drawn at their real pixel width (keeping axis text legible on phones).
 */
export function useElementWidth<T extends HTMLElement>(
  fallback: number,
): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
