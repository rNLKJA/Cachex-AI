"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Colour } from "@/lib/cachex/types";
import { cn } from "@/lib/utils";

export function ColourDot({ colour, className }: { colour: Colour; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        colour === "red"
          ? "bg-red-player shadow-[0_0_10px_var(--player-red)]"
          : "bg-blue-player shadow-[0_0_10px_var(--player-blue)]",
        className,
      )}
    />
  );
}

export const colourName = (c: Colour) => (c === "red" ? "Red" : "Blue");

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
      >
        {label}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={value}
      disabled={disabled}
      aria-label={label}
      onValueChange={(v) => v && onChange(v as T)}
      className="w-full"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          className="data-[state=on]:border-gold/60 data-[state=on]:bg-gold/15 data-[state=on]:text-foreground flex-1 gap-1.5 data-[state=on]:font-semibold"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function BoardSizeSelect({
  id,
  value,
  onChange,
  min = 3,
  max = 10,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n} × {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Panel({
  title,
  children,
  className,
  action,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("bg-card/70 rounded-2xl border p-4 shadow-sm backdrop-blur", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-foreground/90 text-sm font-semibold tracking-wide">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
