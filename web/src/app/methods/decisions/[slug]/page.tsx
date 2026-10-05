import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Markdown } from "@/components/methods/markdown";
import { listDecisions, readDoc, supersededBy, withoutTitle } from "@/lib/content/docs";
import { SITE } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return listDecisions().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = listDecisions().find((x) => x.slug === slug);
  return d
    ? { title: `${d.id}: ${d.title}`, description: `Decision record ${d.id}: ${d.title}.` }
    : {};
}

export default async function DecisionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = listDecisions();
  const index = all.findIndex((x) => x.slug === slug);
  if (index < 0) notFound();
  const d = all[index];
  const markdown = readDoc(`decisions/${slug}.md`);
  const prev = all[index - 1];
  const next = all[index + 1];
  const later = supersededBy(d.id);
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6 lg:py-10">
      <Link
        href="/methods#decisions"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Methods &amp; decisions
      </Link>
      <PageHeader eyebrow={`Decision record · ${d.id}`} title={d.title} />
      {later.length > 0 && (
        <p className="border-gold/50 bg-gold/10 rounded-xl border p-3 text-sm">
          Part of this record has been superseded by{" "}
          {later.map((x, i) => (
            <span key={x.slug}>
              {i > 0 && ", "}
              <Link href={`/methods/decisions/${x.slug}`} className="underline underline-offset-4">
                {x.id}: {x.title}
              </Link>
            </span>
          ))}
          . The record below is unchanged, as written at the time.
        </p>
      )}
      <article className="bg-card/40 rounded-3xl border p-5 sm:p-8">
        <Markdown source={withoutTitle(markdown)} />
      </article>
      <nav
        aria-label="Other decision records"
        className="flex flex-wrap justify-between gap-3 text-sm"
      >
        {prev ? (
          <Link href={`/methods/decisions/${prev.slug}`} className="underline underline-offset-4">
            ← {prev.id}: {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/methods/decisions/${next.slug}`} className="underline underline-offset-4">
            {next.id}: {next.title} →
          </Link>
        )}
      </nav>
      <p className="text-muted-foreground text-xs">
        Source:{" "}
        <a
          href={`${SITE.repo}/blob/${SITE.ref}/docs/decisions/${slug}.md`}
          target="_blank"
          rel="noreferrer"
          className="font-mono underline underline-offset-4"
        >
          docs/decisions/{slug}.md
        </a>
      </p>
    </div>
  );
}
