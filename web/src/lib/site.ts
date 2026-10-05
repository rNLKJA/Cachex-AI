export const SITE = {
  name: "Cachex Arena",
  description:
    "Play Cachex against the minimax agent we built for COMP30024 Artificial Intelligence at the University of Melbourne, watch agents battle, and step through our A* search.",
  repo: "https://github.com/rNLKJA/Cachex-AI",
  /** Placeholder until the Vercel deployment exists. */
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
  { href: "/#about", label: "About" },
] as const;
