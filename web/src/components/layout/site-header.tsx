"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { GitHubIcon } from "./github-icon";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-border/70 bg-background/75 sticky top-0 z-40 border-b backdrop-blur-xl">
      <a
        href="#main"
        className="focus:bg-card sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
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
          aria-label="Main"
          className="ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto sm:ml-6"
        >
          {NAV.map((item) => {
            const active = item.href === "/#about" ? false : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
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
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-lg transition-colors"
          >
            <GitHubIcon className="size-4" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
