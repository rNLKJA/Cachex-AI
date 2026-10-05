/**
 * Renders the repository's markdown documents (decision records, agent card,
 * AI use statement) in the site's typography. Server Component.
 */
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Map links between docs to site routes; other repo-relative links go to GitHub. */
function resolveHref(href: string): { href: string; external: boolean } {
  if (/^https?:\/\//.test(href) || href.startsWith("#") || href.startsWith("/")) {
    return { href, external: /^https?:\/\//.test(href) };
  }
  const dr = href.match(/(DR-\d{3}-[\w-]+)\.md$/);
  if (dr) return { href: `/methods/decisions/${dr[1]}`, external: false };
  if (href.endsWith("model-card.md")) return { href: "/methods/agent-card", external: false };
  if (href.endsWith("ai-use-statement.md")) return { href: "/methods#ai-use", external: false };
  return { href: `${SITE.repo}/blob/main/docs/${href}`, external: true };
}

const components: Components = {
  h1: ({ children }) => <h2 className="mt-8 text-2xl font-semibold first:mt-0">{children}</h2>,
  h2: ({ children }) => (
    <h2 className="mt-8 text-xl font-semibold first:mt-0 sm:text-2xl">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-6 text-lg font-semibold">{children}</h3>,
  p: ({ children }) => <p className="text-foreground/90 mt-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="text-foreground/90 leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
  a: ({ href = "", children }) => {
    const r = resolveHref(href);
    return r.external ? (
      <a href={r.href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
        {children}
      </a>
    ) : (
      <Link href={r.href} className="underline underline-offset-4">
        {children}
      </Link>
    );
  },
  code: ({ className, children }) =>
    className ? (
      <code className={cn("font-mono text-xs", className)}>{children}</code>
    ) : (
      <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="bg-muted/60 mt-3 overflow-x-auto rounded-xl border p-3 text-xs">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="relative mt-4 overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="text-muted-foreground text-left text-xs">{children}</thead>
  ),
  tr: ({ children }) => <tr className="border-border/60 border-b last:border-0">{children}</tr>,
  th: ({ children }) => <th className="py-2 pr-3 font-medium">{children}</th>,
  td: ({ children }) => <td className="py-2 pr-3 align-top">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="border-gold/60 text-muted-foreground mt-3 border-l-2 pl-4">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8" />,
};

export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
