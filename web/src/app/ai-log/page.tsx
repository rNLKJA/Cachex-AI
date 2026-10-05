import type { Metadata } from "next";
import Link from "next/link";

import { AiLogClient } from "@/components/ai/ai-log-client";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "AI audit log",
  description:
    "Every AI call made from this browser: feature, provider, model, exact input, output, latency, tokens, the grounding check and your review decision. Exportable as JSON or CSV. API keys are never recorded.",
};

export default function AiLogPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader eyebrow="Transparency" title="AI audit log">
        <p>
          Every call the optional AI features make is recorded here: what was sent, what came back,
          which provider and model, how long it took, the tokens the provider reported, the
          automated grounding check for commentary, and your decision on the output (accepted,
          edited or rejected; automated evaluation calls are marked n/a).
        </p>
        <p className="text-sm">
          The log lives only in this browser (IndexedDB). This static site has no server, so nothing
          here is sent to us. Your API key is never written to the log.{" "}
          <Link href="/methods#ai-use" className="underline underline-offset-4">
            AI use statement
          </Link>
          .
        </p>
      </PageHeader>
      <AiLogClient />
    </div>
  );
}
