import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
      {children && <div className="text-muted-foreground mt-3 space-y-2">{children}</div>}
    </div>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("bg-card/40 scroll-mt-20 rounded-3xl border p-4 sm:p-8", className)}
    >
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            {eyebrow}
          </p>
        )}
        <h2 id={`${id}-title`} className="mt-1 text-2xl font-semibold sm:text-3xl">
          {title}
        </h2>
        {intro && <div className="text-muted-foreground mt-2 space-y-2">{intro}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Finding({ children }: { children: ReactNode }) {
  return (
    <li className="bg-background/50 rounded-xl border p-3 text-sm leading-relaxed">{children}</li>
  );
}
