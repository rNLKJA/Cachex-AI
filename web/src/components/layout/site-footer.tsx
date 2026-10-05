import Link from "next/link";

import { SITE } from "@/lib/site";
import { LogoMark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-border/70 border-t">
      <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md space-y-2">
          <div className="text-foreground flex items-center gap-2">
            <LogoMark className="size-6" />
            <span className="font-display font-semibold">{SITE.name}</span>
          </div>
          <p>
            A revival of team _4399&apos;s {SITE.subject.code} {SITE.subject.name} project
            (University of Melbourne, {SITE.subject.term}) by Sunchuangyu &ldquo;Rin&rdquo; Huang
            and Wei Zhao. The original Python submission is preserved unchanged in the repository.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2">
          <Link className="hover:text-foreground" href="/play">
            Play the agent
          </Link>
          <Link className="hover:text-foreground" href="/spectate">
            AI vs AI
          </Link>
          <Link className="hover:text-foreground" href="/astar">
            A* Lab
          </Link>
          <Link className="hover:text-foreground" href="/tournament">
            Tournament
          </Link>
          <Link className="hover:text-foreground" href="/llm-arena">
            LLM Arena
          </Link>
          <Link className="hover:text-foreground" href="/methods">
            Methods &amp; decisions
          </Link>
          <Link className="hover:text-foreground" href="/ai-log">
            AI audit log
          </Link>
          <Link className="hover:text-foreground" href="/tour">
            Guided tour
          </Link>
          <Link className="hover:text-foreground" href="/#about">
            About
          </Link>
          <a className="hover:text-foreground" href={SITE.repo} target="_blank" rel="noreferrer">
            GitHub repository
          </a>
          <a
            className="hover:text-foreground"
            href={`${SITE.repo}/tree/main/coursework`}
            target="_blank"
            rel="noreferrer"
          >
            Original coursework
          </a>
        </nav>
      </div>
    </footer>
  );
}
