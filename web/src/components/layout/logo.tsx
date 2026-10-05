import { cn } from "@/lib/utils";

/** Two interlocking hexes: Red and Blue. */
export function LogoMark({ className }: { className?: string }) {
  const hex = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k - 90);
      return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    }).join(" ");
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <polygon points={hex(12, 14, 9)} style={{ fill: "var(--player-red)" }} />
      <polygon points={hex(20, 19, 9)} style={{ fill: "var(--player-blue)" }} opacity={0.92} />
      <polygon points={hex(16, 16.5, 3.4)} style={{ fill: "var(--background)" }} opacity={0.9} />
    </svg>
  );
}
