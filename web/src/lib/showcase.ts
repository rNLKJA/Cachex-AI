/**
 * The guided tour: recorded walkthroughs and key-feature screenshots.
 *
 * One source of truth for the step captions. The Playwright tour
 * (e2e/showcase.spec.ts) shows them as on-screen captions and writes them to
 * WebVTT files, the /tour page lists them under each video, and the README's
 * "Workflow walkthrough" repeats them. Media are produced by `pnpm showcase`.
 */

export type WalkthroughId = "play-the-agent" | "astar-lab" | "tournament-llm-eval";

export interface Walkthrough {
  id: WalkthroughId;
  title: string;
  /** Route the walkthrough starts on. */
  route: string;
  summary: string;
  /** Seeds and settings, so the recording can be reproduced by hand. */
  setup: string;
  /** On-screen captions, in order (step k is shown as "k/N"). */
  steps: readonly string[];
  /** Step numbers (1-based) whose caption shows the "mocked AI response" badge. */
  mockedSteps?: readonly number[];
}

export const MOCK_MODEL_ID = "mock-for-illustration";
export const MOCK_LABEL = "Mocked AI response for illustration";

export const WALKTHROUGHS: readonly Walkthrough[] = [
  {
    id: "play-the-agent",
    title: "Play the agent",
    route: "/play",
    summary:
      "A short game on 5 × 5 against the ported minimax agent: the opening steal, a capture, a recapture, and the agent's own explanation of its move.",
    setup: "5 × 5, you play Red against the minimax agent, page seed 4399.",
    steps: [
      "Open Play: a 5 × 5 board against the minimax agent (seed 4399), coordinates on",
      "Red opens on the strong cell (1, 1)",
      "Blue steals: Red's opening tile is mirrored across the diagonal and becomes Blue's",
      "Red plays (0, 1); the agent answers at (4, 1)",
      "Red plays (1, 0), leaving two red tiles inside a diamond",
      "Capture: Blue closes the diamond at (0, 0) and removes both red tiles",
      "Red retakes (0, 1); the agent plays (1, 4)",
      "Recapture: Red plays (1, 0) and removes Blue's (0, 0) and (1, 1)",
      "Why that move? Pick the capture in the move log: search depth, candidate scores, features",
    ],
  },
  {
    id: "astar-lab",
    title: "A* Lab",
    route: "/astar",
    summary:
      "The original Part A sample input, searched with both heuristics and animated expansion by expansion, then the paired study that compares them on 980 boards.",
    setup: "Preset “Sample input 1” (code/sample_input.json); reference study seed 2022.",
    steps: [
      "Open the A* Lab: the Part A search, ported line by line from Python",
      "Load the original sample input (code/sample_input.json)",
      "Manhattan, as in the recorded output: animate the expansions",
      "An 8-cell path that matches sample_output.txt from the original repo",
      "Switch to Euclidean and animate the same board",
      "Same board, both heuristics: path cost, nodes expanded, queue pushes",
      "Paired study on 980 boards: paired bootstrap CI and Wilcoxon test on expansions",
      "Optimality against breadth-first search: paired difference and exact McNemar test",
    ],
  },
  {
    id: "tournament-llm-eval",
    title: "Tournament and LLM evaluation",
    route: "/tournament",
    summary:
      "A small seeded round robin with interval estimates, then the bring-your-own-key settings and the LLM-as-a-player harness, shown with a mocked model reply (no real key is used).",
    setup:
      "Round robin: 4 agents, 4 × 4, 2 colour-swapped pairs, seed 4399. LLM Arena: 2 games on 4 × 4, seed 2026, mocked replies.",
    steps: [
      "Open the tournament harness: a seeded, colour-swapped round robin",
      "Keep 4 agents and seed 4399; 4 × 4 only, 2 colour-swapped pairs: 24 games",
      "Run all 24 games in parallel Web Workers",
      "Win rates with Wilson 95% CIs, Bradley-Terry strengths with bootstrap CIs",
      "AI settings: bring your own key, kept in this browser and sent only to the provider",
      `For this demo: a placeholder key and the model id “${MOCK_MODEL_ID}”, no real key`,
      "LLM Arena: 2 games on 4 × 4 against the minimax agent, on the baselines' seeds",
      "Every reply is checked against the legal moves and labelled AI-generated",
      "Side by side with random, greedy and scripted baselines, Wilson 95% CIs",
      "Every call is in the AI audit log, with JSON and CSV export",
      "Forget key: the placeholder is removed from this browser",
    ],
    mockedSteps: [6, 7, 8, 9, 10],
  },
];

export interface Screenshot {
  /** File name without extension, e.g. "01-landing-light". */
  id: string;
  title: string;
  caption: string;
  viewport: "desktop" | "mobile";
}

export const SCREENSHOTS: readonly Screenshot[] = [
  {
    id: "01-landing-light",
    title: "Landing page",
    caption: "The game, the coursework and the key results, each with its interval.",
    viewport: "desktop",
  },
  {
    id: "02-landing-dark",
    title: "Landing page, dark mode",
    caption: "The same page in dark mode.",
    viewport: "desktop",
  },
  {
    id: "03-play",
    title: "Play the agent",
    caption: "After a capture and a recapture on 5 × 5, with the agent's search for its capture.",
    viewport: "desktop",
  },
  {
    id: "04-spectate",
    title: "AI vs AI",
    caption: "A seeded agent-vs-agent game with the evaluation trend.",
    viewport: "desktop",
  },
  {
    id: "05-astar-lab",
    title: "A* Lab",
    caption: "The original sample input: an 8-cell path that matches the recorded output.",
    viewport: "desktop",
  },
  {
    id: "06-astar-paired-study",
    title: "Paired heuristic study",
    caption: "980 paired boards: bootstrap CI, Wilcoxon test, BFS optimality and McNemar.",
    viewport: "desktop",
  },
  {
    id: "07-tournament",
    title: "Tournament harness",
    caption: "A seeded 24-game round robin: Wilson and bootstrap 95% intervals.",
    viewport: "desktop",
  },
  {
    id: "08-ai-settings",
    title: "Bring your own key",
    caption: "AI settings: Anthropic by default, the key stays in this browser.",
    viewport: "desktop",
  },
  {
    id: "09-llm-arena",
    title: "LLM Arena",
    caption: "The LLM-as-a-player harness and its baselines on the same seeds (no key needed).",
    viewport: "desktop",
  },
  {
    id: "10-methods",
    title: "Methods",
    caption: "Provenance, evaluation design, limitations, decision records and AI use.",
    viewport: "desktop",
  },
  {
    id: "11-mobile-landing",
    title: "Mobile: landing",
    caption: "The landing page at 390 px.",
    viewport: "mobile",
  },
  {
    id: "12-mobile-play",
    title: "Mobile: play",
    caption: "Playing the agent on a phone, after the recapture.",
    viewport: "mobile",
  },
  {
    id: "13-mobile-astar",
    title: "Mobile: A* Lab",
    caption: "The A* Lab with the sample input's path.",
    viewport: "mobile",
  },
];

/** Public paths of a walkthrough's media (files live in web/public/showcase/). */
export function walkthroughMedia(id: WalkthroughId) {
  return {
    mp4: `/showcase/${id}.mp4`,
    poster: `/showcase/${id}-poster.webp`,
    captions: `/showcase/${id}.vtt`,
  };
}

/** Public path of a screenshot's WebP copy used by /tour. */
export const screenshotSrc = (id: string) => `/showcase/screens/${id}.webp`;

/** Pixel size of the WebP copies (desktop 1440 × 900; mobile 390 × 844 at 1.5×). */
export const SCREENSHOT_SIZE = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 585, height: 1266 },
} as const;
