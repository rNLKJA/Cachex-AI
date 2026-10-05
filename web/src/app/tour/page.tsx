import { ArrowRight, Clapperboard, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, Section } from "@/components/layout/page-header";
import { LazyVideo } from "@/components/tour/lazy-video";
import { ScreenshotGallery } from "@/components/tour/screenshot-gallery";
import { Button } from "@/components/ui/button";
import {
  MOCK_LABEL,
  MOCK_MODEL_ID,
  SCREENSHOTS,
  WALKTHROUGHS,
  type Walkthrough,
  walkthroughMedia,
} from "@/lib/showcase";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Guided tour",
  description:
    "Three short captioned walkthroughs (play the agent, the A* Lab, the tournament and LLM evaluation) and screenshots of every key feature, recorded by a reproducible Playwright script.",
};

const SPEC_URL = `${SITE.repo}/blob/${SITE.ref}/web/e2e/showcase.spec.ts`;

export default function TourPage() {
  return (
    <div className="table-felt">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:px-6 lg:py-10">
        <PageHeader eyebrow="Guided tour" title="Cachex Arena in three short walkthroughs">
          <p>
            Each video follows one workflow from start to finish, with the step shown on screen and
            as captions. They were recorded from this site by a Playwright script that also checks
            every step (the steal, both captures, the recorded A* output, the seeded tournament), so
            the same seeds reproduce the same moves and numbers.
          </p>
          <nav aria-label="Walkthroughs" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {WALKTHROUGHS.map((w, i) => (
              <a key={w.id} href={`#${w.id}`} className="underline underline-offset-4">
                {i + 1}. {w.title}
              </a>
            ))}
            <a href="#screenshots" className="underline underline-offset-4">
              Screenshots
            </a>
          </nav>
        </PageHeader>

        {WALKTHROUGHS.map((w, i) => (
          <WalkthroughSection key={w.id} walkthrough={w} index={i} />
        ))}

        <Section
          id="screenshots"
          eyebrow="Screenshots"
          title="Every key feature at a glance"
          intro={
            <p>
              Captured by the same script, in light mode at 1440 × 900 (the landing page also in
              dark mode) and on a 390 px phone. Select one to enlarge it; use the arrow keys to step
              through.
            </p>
          }
        >
          <ScreenshotGallery items={SCREENSHOTS} />
        </Section>

        <section
          aria-labelledby="how-made"
          className="bg-card/40 grid gap-4 rounded-3xl border p-4 sm:p-8 md:grid-cols-[auto_1fr]"
        >
          <Clapperboard className="text-gold size-6" aria-hidden />
          <div className="space-y-2">
            <h2 id="how-made" className="text-xl font-semibold">
              How these were made
            </h2>
            <p className="text-muted-foreground text-sm">
              <code className="font-mono">pnpm showcase</code> runs{" "}
              <a href={SPEC_URL} target="_blank" rel="noreferrer" className="underline">
                web/e2e/showcase.spec.ts
              </a>{" "}
              on the system Chrome: it plays each journey at a human pace with an on-screen caption
              and cursor, asserts what it shows, and records it at 1280 × 800. ffmpeg then encodes
              the H.264 videos here and the GIFs in the README. The captions on this page are the
              same text as the on-screen steps.
            </p>
            <p className="text-muted-foreground text-sm">
              No real API key is used anywhere in these recordings. Where an AI feature appears, the
              key is a placeholder, every request to the provider is intercepted in the browser, and
              the reply is a labelled mock.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/** "Steps 6 to 10" for a run of consecutive steps, otherwise "Steps 2, 5 and 7". */
function stepRange(steps: number[]) {
  const sorted = [...steps].sort((a, b) => a - b);
  const consecutive = sorted.every((s, i) => i === 0 || s === sorted[i - 1] + 1);
  if (sorted.length > 2 && consecutive) return `Steps ${sorted[0]} to ${sorted.at(-1)}`;
  if (sorted.length === 1) return `Step ${sorted[0]}`;
  return `Steps ${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
}

function WalkthroughSection({
  walkthrough: w,
  index,
}: {
  walkthrough: Walkthrough;
  index: number;
}) {
  const media = walkthroughMedia(w.id);
  const mocked = new Set(w.mockedSteps ?? []);
  const titleId = `${w.id}-steps`;
  return (
    <Section
      id={w.id}
      eyebrow={`Walkthrough ${index + 1} of ${WALKTHROUGHS.length} · ${w.route}`}
      title={w.title}
      intro={<p>{w.summary}</p>}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <figure className="min-w-0 space-y-3">
          <LazyVideo
            src={media.mp4}
            poster={media.poster}
            captions={media.captions}
            label={`${w.title}: a ${w.steps.length}-step walkthrough with captions`}
            width={1280}
            height={800}
          />
          <figcaption className="text-muted-foreground flex flex-wrap items-start gap-x-4 gap-y-1 text-xs">
            <span>
              <span className="text-foreground font-medium">Setup:</span> {w.setup}
            </span>
            <a href={media.mp4} className="underline underline-offset-4">
              Open the MP4
            </a>
          </figcaption>
          {mocked.size > 0 && (
            <p className="border-gold/50 bg-gold/10 flex gap-2.5 rounded-xl border border-dashed p-3 text-sm">
              <Info className="text-gold-ink mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>{MOCK_LABEL}.</strong> {stepRange([...mocked])} use a placeholder key and
                the model id <code className="font-mono">{MOCK_MODEL_ID}</code>. Requests to the
                provider are intercepted in the browser and answered by a mock that plays the first
                legal cell; no model was called, so the LLM row shows the mock, not a real
                model&apos;s results.
              </span>
            </p>
          )}
        </figure>

        <div className="space-y-4">
          <h3 id={titleId} className="font-semibold">
            Steps <span className="text-muted-foreground font-normal">(transcript)</span>
          </h3>
          <ol aria-labelledby={titleId} className="space-y-2">
            {w.steps.map((step, k) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="bg-gold/20 text-gold-ink flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1 font-mono text-xs font-semibold tabular-nums">
                  {k + 1}
                </span>
                <span className="pt-0.5">
                  {step}
                  {mocked.has(k + 1) && (
                    <span className="text-muted-foreground block text-xs">
                      Mocked AI response for illustration
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <Button asChild variant="outline">
            <Link href={w.route}>
              Try it yourself <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
