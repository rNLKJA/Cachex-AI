import type { Metadata } from "next";
import Link from "next/link";

import { LlmArenaClient } from "@/components/ai/llm-arena-client";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "LLM Arena",
  description:
    "An evaluation harness: a language model (your own API key) plays short games of Cachex against the original minimax agent, with legal-move validation, Wilson intervals and a full audit log.",
};

export default function LlmArenaPage() {
  return (
    <div className="table-felt">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:py-10">
        <PageHeader
          eyebrow="LLM evaluation · bring your own key"
          title="Can a language model beat our 2022 agent?"
        >
          <p>
            The model plays short games against the original minimax agent. Each turn it gets the
            rules, the board, the move history and the full list of legal moves, and must answer
            with a JSON move. The referee checks every answer: an illegal or malformed one is
            counted and the model is asked again (up to three times) before it forfeits.
          </p>
          <p className="text-sm">
            The same seeds and colours are replayed with the random and greedy agents in the
            model&apos;s seat, so the comparison is like for like. This page is an evaluation
            harness, not a claim: a few games give wide intervals.{" "}
            <Link href="/methods#ai-use" className="underline underline-offset-4">
              What is sent to the provider
            </Link>
            .
          </p>
        </PageHeader>
        <LlmArenaClient />
      </div>
    </div>
  );
}
