"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { AiSettingsButton } from "@/components/ai/ai-settings-button";
import { NAV, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { GitHubIcon } from "./github-icon";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // On narrow screens the nav scrolls sideways: keep the current page's link visible.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active) {
      const n = nav.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      if (a.left < n.left || a.right > n.right) {
        nav.scrollLeft += a.left - n.left - (n.width - a.width) / 2;
      }
    }
  }, [pathname]);

  return (
    <header className="border-border/70 bg-background/75 sticky top-0 z-40 border-b backdrop-blur-xl">
      <a
        href="#main"
        className="focus:bg-card sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md"
          aria-label="Cachex Arena home"
        >
          <LogoMark />
          <span className="font-display hidden text-lg font-semibold tracking-tight sm:inline">
            {SITE.name}
          </span>
        </Link>
        <nav
          ref={navRef}
          aria-label="Main"
          className="ml-auto flex min-w-0 [scrollbar-width:none] items-center gap-0 overflow-x-auto max-md:[mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent)] sm:ml-6 sm:gap-0.5"
        >
          {NAV.map((item) => {
            // Match whole path segments: /tournament must not light up /tour.
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // The nav scrolls sideways and would clip an outside focus ring: draw it inside.
                  "text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-offset-[-2px] sm:px-2.5",
                  active && "bg-muted text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-0.5 sm:ml-auto">
          <a
            href={SITE.repo}
            target="_blank"
            rel="noreferrer"
            aria-label="Source code on GitHub"
            className="text-muted-foreground hover:bg-muted hover:text-foreground hidden size-8 items-center justify-center rounded-lg transition-colors sm:inline-flex"
          >
            <GitHubIcon className="size-4" />
          </a>
          <AiSettingsButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
