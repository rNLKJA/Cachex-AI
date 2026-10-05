import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Markdown } from "@/components/methods/markdown";
import { readDoc, withoutTitle } from "@/lib/content/docs";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agent card",
  description:
    "Agent card for the _4399 minimax agent: intended use, provenance, evaluation with confidence intervals, known weaknesses and ethical considerations.",
};

export default function AgentCardPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6 lg:py-10">
      <Link
        href="/methods#decisions"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Methods &amp; decisions
      </Link>
      <PageHeader eyebrow="Agent card" title="The _4399 minimax agent" />
      <article className="bg-card/40 rounded-3xl border p-5 sm:p-8">
        <Markdown source={withoutTitle(readDoc("model-card.md"))} />
      </article>
      <p className="text-muted-foreground text-xs">
        Source:{" "}
        <a
          href={`${SITE.repo}/blob/main/docs/model-card.md`}
          target="_blank"
          rel="noreferrer"
          className="font-mono underline underline-offset-4"
        >
          docs/model-card.md
        </a>
        . Live numbers with downloadable data:{" "}
        <Link href="/tournament" className="underline underline-offset-4">
          /tournament
        </Link>
        .
      </p>
    </div>
  );
}
