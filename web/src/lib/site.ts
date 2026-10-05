export const SITE = {
  name: "Cachex Arena",
  description:
    "Play Cachex against the minimax agent we built for COMP30024 Artificial Intelligence at the University of Melbourne, watch agents battle, and step through our A* search.",
  repo: "https://github.com/rNLKJA/Cachex-AI",
  /**
   * Git ref that "source" links point at: the deployed commit when the build
   * knows it (see next.config.ts), so links never 404 for files that exist
   * only on an unmerged branch; otherwise main.
   */
  ref: process.env.NEXT_PUBLIC_GIT_REF || "main",
  /** Production URL on Vercel (override with NEXT_PUBLIC_SITE_URL). */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://cachex-ai.vercel.app",
  subject: { code: "COMP30024", name: "Artificial Intelligence", term: "Semester 1, 2022" },
  team: [
    { name: 'Sunchuangyu "Rin" Huang', github: "https://github.com/rNLKJA" },
    { name: "Wei Zhao", github: null },
  ],
} as const;

export const NAV = [
  { href: "/play", label: "Play" },
  { href: "/spectate", label: "Spectate" },
  { href: "/astar", label: "A* Lab" },
  { href: "/tournament", label: "Tournament" },
  { href: "/llm-arena", label: "LLM Arena" },
  { href: "/methods", label: "Methods" },
] as const;
