/**
 * Forest-plot style interval marks for tables: a 2px interval line with end
 * caps and an 8px point estimate wearing a surface ring, on a hairline track
 * with an optional reference line (e.g. 50% or 0). Exact numbers always sit
 * in an adjacent cell, so the mark never carries information on its own.
 */
import { cn } from "@/lib/utils";

const clamp = (x: number) => Math.min(100, Math.max(0, x));

export function IntervalBar({
  estimate,
  lower,
  upper,
  min,
  max,
  reference,
  label,
  className,
}: {
  estimate: number;
  lower: number;
  upper: number;
  min: number;
  max: number;
  reference?: number;
  /** Accessible description, also shown as a tooltip. */
  label: string;
  className?: string;
}) {
  const pct = (x: number) => clamp(((x - min) / (max - min || 1)) * 100);
  const lo = pct(Math.min(lower, upper));
  const hi = pct(Math.max(lower, upper));
  const valid = [estimate, lower, upper].every(Number.isFinite);
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn("relative h-5 w-full min-w-24", className)}
    >
      <div className="bg-border absolute inset-x-0 top-1/2 h-px" aria-hidden />
      {reference !== undefined && (
        <div
          aria-hidden
          className="bg-foreground/35 absolute top-0.5 bottom-0.5 w-px"
          style={{ left: `${pct(reference)}%` }}
        />
      )}
      {valid && (
        <>
          <div
            aria-hidden
            className="bg-primary/75 absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
            style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 0.5)}%` }}
          />
          <div
            aria-hidden
            className="bg-primary/75 absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${lo}%` }}
          />
          <div
            aria-hidden
            className="bg-primary/75 absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${hi}%` }}
          />
          <div
            aria-hidden
            className="bg-primary ring-card absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
            style={{ left: `${pct(estimate)}%` }}
          />
        </>
      )}
    </div>
  );
}

/** Axis labels for a column of IntervalBars (put it in the header cell). */
export function IntervalAxis({
  min,
  max,
  ticks,
  format,
}: {
  min: number;
  max: number;
  ticks: number[];
  format: (x: number) => string;
}) {
  return (
    <div className="relative h-4 w-full min-w-24" aria-hidden>
      {ticks.map((t, i) => {
        const left = clamp(((t - min) / (max - min || 1)) * 100);
        const align =
          i === 0
            ? "translate-x-0"
            : i === ticks.length - 1
              ? "-translate-x-full"
              : "-translate-x-1/2";
        return (
          <span
            key={t}
            className={cn(
              "text-muted-foreground absolute top-0 font-mono text-[10px] font-normal whitespace-nowrap",
              align,
            )}
            style={{ left: `${left}%` }}
          >
            {format(t)}
          </span>
        );
      })}
    </div>
  );
}

/** "76.0% [72.0, 79.6]" style estimate with its interval, interval de-emphasised. */
export function EstimateCI({
  estimate,
  interval,
  className,
}: {
  estimate: string;
  interval: string;
  className?: string;
}) {
  return (
    <span className={cn("font-mono whitespace-nowrap tabular-nums", className)}>
      {estimate} <span className="text-muted-foreground text-[0.85em]">{interval}</span>
    </span>
  );
}

/** Nice round ticks spanning [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step)
    out.push(Number(t.toFixed(10)));
  return out;
}
