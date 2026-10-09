import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CirclePlay,
  FlaskConical,
  GitBranch,
  NotebookPen,
  Route,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import Link from "next/link";

import { HexBoard } from "@/components/board/hex-board";
import { StaticBoard } from "@/components/landing/static-board";
import { GitHubIcon } from "@/components/layout/github-icon";
import { ColourDot } from "@/components/play/primitives";
import { IntervalBar } from "@/components/stats/interval";
import { ScrollRegion } from "@/components/stats/scroll-table";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/agent/evaluation";
import { TARGET_RATES } from "@/lib/agent/player";
import { deterministicSelfPlay } from "@/lib/agent/self-play";
import benchmark from "@/lib/data/agent-benchmark.json";
import { SITE } from "@/lib/site";
import { formatPct } from "@/lib/stats/format";
import { wilson } from "@/lib/stats/proportion";

export default function HomePage() {
  const { game } = deterministicSelfPlay(7);
  const cells: ("red" | "blue" | null)[] = [];
  for (let r = 0; r < 7; r++) for (let q = 0; q < 7; q++) cells.push(game.board.get(r, q));
  const winning = game.result?.kind === "win" ? game.result.cluster : null;
  const last = game.log.at(-1)!;
  const lastMove = last.action[0] === "PLACE" ? ([last.action[1], last.action[2]] as const) : null;

  const totals = benchmark.results.reduce(
    (acc, r) => ({ wins: acc.wins + r.wins, games: acc.games + r.games }),
    { wins: 0, games: 0 },
  );
  const winRate = Math.round((totals.wins / totals.games) * 100);
  const rowCI = (r: { wins: number; games: number }) => wilson(r.wins, r.games);
  const winCI = wilson(totals.wins, totals.games);

  return (
    <div className="table-felt">
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-24">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.22em] uppercase">
            {SITE.subject.code} · {SITE.subject.name} · University of Melbourne
          </p>
          <h1 className="mt-4 text-5xl leading-[0.95] font-semibold sm:text-6xl lg:text-7xl">
            Cachex
            <br />
            <span className="from-red-player via-gold to-blue-player bg-gradient-to-r bg-clip-text text-transparent">
              Arena
            </span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg">
            In 2022 we built a game-playing agent for{" "}
            <strong className="text-foreground">Cachex</strong>, a Hex-like race to connect opposite
            edges of a hexagonal board, with captures and a first-move steal. Here it is again,
            ported line by line from Python to run in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <Link href="/play">
                <Swords /> Play the agent
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
              <Link href="/spectate">
                <Bot /> Watch AI vs AI
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-11 px-4 text-base">
              <Link href="/astar">
                <Route /> A* Lab <ArrowRight />
              </Link>
            </Button>
          </div>
          <Link
            href="/tour"
            className="group border-gold/40 bg-gold/10 hover:bg-gold/20 focus-visible:ring-ring/50 mt-5 inline-flex items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-sm transition-colors outline-none focus-visible:ring-3"
          >
            <span className="bg-gold text-background flex size-7 items-center justify-center rounded-full">
              <CirclePlay className="size-4" aria-hidden />
            </span>
            <span>
              <span className="font-medium">New here? Take the guided tour</span>
              <span className="text-muted-foreground"> · three short walkthroughs</span>
            </span>
            <ArrowRight
              className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
        <figure className="relative mx-auto w-full max-w-xl">
          <div className="bg-gold/10 absolute inset-8 -z-10 rounded-full blur-3xl" aria-hidden />
          <HexBoard
            n={7}
            cells={cells}
            winning={winning}
            lastMove={lastMove}
            label="Final position of the agent playing itself on a 7 by 7 board: Red has connected top and bottom."
            className="drop-shadow-[0_30px_60px_rgb(0_0_0/0.3)]"
          />
          <figcaption className="text-muted-foreground mt-3 text-center text-xs">
            A real game: the ported agent playing itself on 7 × 7. Red wins in {game.nturns} turns.
          </figcaption>
        </figure>
      </section>

      {/* Rules */}
      <section aria-labelledby="rules" className="bg-card/30 border-y">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading id="rules" eyebrow="The game" title="Three rules, a lot of tension">
            Two players take turns placing a tile on any empty hex. Whoever links their two edges
            first wins.
          </SectionHeading>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <RuleCard
              title="Connect your edges"
              body="Red links the top and bottom edges; Blue links the left and right. A chain of touching tiles is all it takes."
              caption="Red's chain runs from row 0 to row 4."
            >
              <StaticBoard
                className="h-full w-auto"
                label="Red chain connecting top and bottom on a 5 by 5 board"
                position={{
                  n: 5,
                  tiles: [
                    { colour: "red", coord: [0, 2] },
                    { colour: "red", coord: [1, 2] },
                    { colour: "red", coord: [2, 1] },
                    { colour: "red", coord: [3, 1] },
                    { colour: "red", coord: [4, 0] },
                    { colour: "blue", coord: [2, 3] },
                    { colour: "blue", coord: [3, 2] },
                    { colour: "blue", coord: [1, 0] },
                  ],
                }}
                winning={[
                  [0, 2],
                  [1, 2],
                  [2, 1],
                  [3, 1],
                  [4, 0],
                ]}
              />
            </RuleCard>
            <RuleCard
              title="Capture with a diamond"
              body="Place a tile that closes a diamond around exactly two enemy tiles, with your own tile opposite, and both enemy tiles are removed."
              caption="Blue plays (2, 1) and captures Red's (1, 1) and (2, 0)."
            >
              <div className="grid w-full grid-cols-2 items-center gap-3">
                <figure>
                  <StaticBoard
                    label="Before: Red tiles at (1, 1) and (2, 0) sit between Blue's (1, 0) and the empty cell (2, 1)"
                    highlights={[[2, 1]]}
                    position={{
                      n: 4,
                      tiles: [
                        { colour: "blue", coord: [1, 0] },
                        { colour: "red", coord: [1, 1] },
                        { colour: "red", coord: [2, 0] },
                      ],
                    }}
                  />
                  <figcaption className="text-muted-foreground mt-1 text-center text-xs">
                    Before
                  </figcaption>
                </figure>
                <figure>
                  <StaticBoard
                    label="After: Blue played (2, 1) and both red tiles were captured"
                    lastMove={[2, 1]}
                    position={{
                      n: 4,
                      tiles: [
                        { colour: "blue", coord: [1, 0] },
                        { colour: "blue", coord: [2, 1] },
                      ],
                    }}
                  />
                  <figcaption className="text-muted-foreground mt-1 text-center text-xs">
                    After Blue plays
                  </figcaption>
                </figure>
              </div>
            </RuleCard>
            <RuleCard
              title="Steal the opening"
              body="Red moves first, so Blue may answer by stealing: Red's tile is mirrored across the long diagonal and becomes Blue's."
              caption="Red's opening at (1, 3) becomes Blue's (3, 1)."
            >
              <StaticBoard
                className="h-full w-auto"
                label="After a steal, Red's tile at (1, 3) becomes Blue's tile at (3, 1)"
                position={{ n: 5, tiles: [{ colour: "blue", coord: [3, 1] }] }}
                lastMove={[3, 1]}
              />
            </RuleCard>
          </div>
        </div>
      </section>

      {/* Coursework */}
      <section aria-labelledby="coursework" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          id="coursework"
          eyebrow="The coursework"
          title="What we were asked, and what we built"
        >
          The project came in two parts. We have paraphrased the brief here; the original
          specification is not reproduced.
        </SectionHeading>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <article className="bg-card/60 rounded-3xl border p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Route className="text-gold size-5" />
              <h3 className="text-xl font-semibold">Part A · Search</h3>
            </div>
            <p className="text-muted-foreground mt-3">
              <strong className="text-foreground">The task:</strong> given a board with some
              occupied cells, find a shortest chain of empty cells from a start to a goal using A*
              with an admissible heuristic, and print its length and cells.
            </p>
            <p className="text-muted-foreground mt-3">
              <strong className="text-foreground">What we built:</strong> a{" "}
              <code className="font-mono text-sm">CachexBoard</code> of{" "}
              <code className="font-mono text-sm">HexNode</code>s with a priority-queue A* over the
              six hex neighbours, Minkowski heuristics (Manhattan or Euclidean), and an optional
              colour that blocks the search. A notebook experiment compared the heuristics on
              hundreds of random boards.
            </p>
            <p className="text-muted-foreground mt-3">
              <strong className="text-foreground">Corrected in 2026:</strong> our report argued that
              both heuristics were admissible. On this hex grid neither is, so A* can return a
              longer path than the shortest one. The A* Lab measures how often.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/astar">
                Open the A* Lab <ArrowRight />
              </Link>
            </Button>
          </article>
          <article className="bg-card/60 rounded-3xl border p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <BrainCircuit className="text-gold size-5" />
              <h3 className="text-xl font-semibold">Part B · Game-playing agent</h3>
            </div>
            <p className="text-muted-foreground mt-3">
              <strong className="text-foreground">The task:</strong> write a player the
              subject&apos;s referee could run against random, greedy and search-based opponents,
              within time and memory limits.
            </p>
            <ul className="text-muted-foreground mt-3 space-y-2">
              <li>
                <strong className="text-foreground">Minimax with alpha-beta pruning</strong>, Red
                maximising and Blue minimising.
              </li>
              <li>
                <strong className="text-foreground">Dynamic depth:</strong> depth 1 while at least{" "}
                {TARGET_RATES[0] * 100}% of cells are empty, then 2, 3 and 4 below{" "}
                {TARGET_RATES[0] * 100}%, {TARGET_RATES[1] * 100}% and {TARGET_RATES[2] * 100}%.
              </li>
              <li>
                <strong className="text-foreground">Opening book</strong> for the first two turns,
                and an <strong className="text-foreground">instant-win check</strong> before any
                search.
              </li>
            </ul>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/play">
                Play against it <ArrowRight />
              </Link>
            </Button>
          </article>
        </div>

        <div className="bg-card/60 mt-6 rounded-3xl border p-6 sm:p-8">
          <h3 className="text-lg font-semibold">The evaluation function</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Six hand-tuned features from <code className="font-mono">weights.json</code>, scored
            from Red&apos;s point of view (Red&apos;s count adds, Blue&apos;s subtracts).
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.id} className="bg-background/50 rounded-2xl border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{f.label}</span>
                  <span
                    className={
                      f.sign > 0
                        ? "text-gold-ink font-mono text-sm"
                        : "text-destructive font-mono text-sm"
                    }
                  >
                    {f.sign > 0 ? "+" : "−"}
                    {f.weight}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{f.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Results */}
      <section aria-labelledby="results" className="bg-card/30 border-y">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading id="results" eyebrow="Key results" title="From the original code">
            The agent and search results come from running the original Python, unchanged, with the
            subject&apos;s referee. The port is then checked against those same runs.
          </SectionHeading>
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <BigStat
                value={`${winRate}%`}
                label={`wins against the random agent (${totals.wins} of ${totals.games} games, both colours, boards 4 × 4 to 7 × 7; Wilson 95% CI ${formatPct(winCI.lower)} to ${formatPct(winCI.upper)})`}
              />
              <BigStat
                value="8 & 13"
                label="cells in the A* paths for the two sample inputs, matching the recorded outputs"
              />
              <BigStat
                value="Exact"
                label="parity: the TypeScript port reproduces the original paths, node counts, evaluations and moves"
              />
            </div>
            <div className="bg-card/60 min-w-0 rounded-3xl border p-4 sm:p-6">
              <h3 className="font-semibold">Agent _4399 vs the random baseline</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {benchmark.results[0].games} seeded games per row, generated by{" "}
                <code className="font-mono">scripts/benchmark_agent.py</code>. Wilson 95% intervals;
                with {benchmark.results[0].games} games a row each one is wide, so the pooled rate
                is the better summary.
              </p>
              <ScrollRegion label="Agent _4399 vs the random baseline" className="mt-4">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-left">
                    <tr className="border-b">
                      <th scope="col" className="py-2 pr-2 font-medium whitespace-nowrap">
                        Board
                      </th>
                      <th scope="col" className="py-2 pr-2 font-medium">
                        <span className="sm:hidden">Agent</span>
                        <span className="hidden sm:inline">Agent plays</span>
                      </th>
                      <th scope="col" className="py-2 pr-2 font-medium">
                        Win rate <span className="whitespace-nowrap">(95% CI)</span>
                      </th>
                      <th
                        scope="col"
                        className="py-2 pr-2 text-right font-medium whitespace-nowrap"
                      >
                        W–L
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        <span className="sm:hidden">Turns</span>
                        <span className="hidden sm:inline">Avg turns</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmark.results.map((r) => (
                      <tr
                        key={`${r.n}-${r.agentColour}`}
                        className="border-border/50 border-b last:border-0"
                      >
                        <td className="py-2 pr-2 font-mono whitespace-nowrap">
                          {r.n} × {r.n}
                        </td>
                        <td className="py-2 pr-2">
                          <span className="flex items-center gap-2 capitalize">
                            <ColourDot colour={r.agentColour as "red" | "blue"} /> {r.agentColour}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <span className="flex items-center gap-2">
                            <IntervalBar
                              className="hidden w-24 sm:block"
                              estimate={rowCI(r).p}
                              lower={rowCI(r).lower}
                              upper={rowCI(r).upper}
                              min={0}
                              max={1}
                              label={`${r.n} by ${r.n}, agent as ${r.agentColour}: ${r.wins} of ${r.games}, 95% CI ${formatPct(rowCI(r).lower)} to ${formatPct(rowCI(r).upper)}`}
                            />
                            <span className="font-mono tabular-nums">
                              {Math.round(rowCI(r).p * 100)}%
                              <span className="text-muted-foreground block text-[0.7rem] whitespace-nowrap">
                                [{Math.round(rowCI(r).lower * 100)},{" "}
                                {Math.round(rowCI(r).upper * 100)}]
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right font-mono whitespace-nowrap tabular-nums">
                          {r.wins}–{r.losses}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{r.avgTurns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollRegion>
            </div>
          </div>
        </div>
      </section>

      {/* Evaluation */}
      <section aria-labelledby="evaluation" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <SectionHeading
          id="evaluation"
          eyebrow="Measured, not claimed"
          title="How good is it, really?"
        >
          The revival adds a seeded tournament harness, a paired A* study and an optional LLM
          evaluation, each reported with sample sizes and confidence intervals, plus the decisions
          and weaknesses behind them.
        </SectionHeading>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EvalCard
            href="/tournament"
            icon={Trophy}
            title="Tournament"
            body="Round robin against controlled variants, colour-swapped and seeded, with Bradley-Terry strengths and the alpha-beta study."
          />
          <EvalCard
            href="/astar#paired-study"
            icon={FlaskConical}
            title="A* heuristic study"
            body="Manhattan vs Euclidean on 980 paired boards: expansions, Wilcoxon test, and how often each finds a shortest path."
          />
          <EvalCard
            href="/llm-arena"
            icon={Sparkles}
            title="LLM Arena"
            body="Bring your own key: a language model plays the agent, with legal-move validation, intervals and an audit log."
          />
          <EvalCard
            href="/methods"
            icon={NotebookPen}
            title="Methods & decisions"
            body="Provenance, evaluation design, limitations, decision records, the agent card and the AI use statement."
          />
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        aria-labelledby="about-title"
        className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6"
      >
        <SectionHeading id="about-title" eyebrow="About this project" title="Credits and stack">
          {SITE.subject.code} {SITE.subject.name}, University of Melbourne, {SITE.subject.term}.
          Team _4399.
        </SectionHeading>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="bg-card/60 rounded-3xl border p-6">
            <h3 className="font-semibold">Team</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {SITE.team.map((m) => (
                <li key={m.name}>
                  {m.github ? (
                    <a
                      className="underline-offset-4 hover:underline"
                      href={m.github}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {m.name}
                    </a>
                  ) : (
                    m.name
                  )}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-4 text-sm">
              Team _4399, a two-person project. Both members are credited as authors in the original
              source.
            </p>
          </div>
          <div className="bg-card/60 rounded-3xl border p-6">
            <h3 className="font-semibold">Original vs revived stack</h3>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">2022</dt>
              <dd>Python 3.6, NumPy, SciPy, Jupyter, the subject&apos;s referee</dd>
              <dt className="text-muted-foreground">Now</dt>
              <dd>
                Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Web Workers, Vitest
              </dd>
            </dl>
            <p className="text-muted-foreground mt-4 text-sm">
              Parity fixtures are produced by running the original code with{" "}
              <code className="font-mono">uv</code>.
            </p>
          </div>
          <div className="bg-card/60 rounded-3xl border p-6">
            <h3 className="font-semibold">Source and integrity</h3>
            <p className="text-muted-foreground mt-3 text-sm">
              The original submission is preserved unchanged in the repository&apos;s{" "}
              <code className="font-mono">coursework/</code> folder for reference. If you are taking{" "}
              {SITE.subject.code}, please respect academic integrity and do not copy it.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={SITE.repo} target="_blank" rel="noreferrer">
                  <GitHubIcon className="size-4" /> GitHub repository
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={`${SITE.repo}/tree/main/coursework`} target="_blank" rel="noreferrer">
                  <GitBranch /> Original code
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.22em] uppercase">
        {eyebrow}
      </p>
      <h2 id={id} className="mt-2 text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-3">{children}</p>
    </div>
  );
}

function RuleCard({
  title,
  body,
  caption,
  children,
}: {
  title: string;
  body: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <article className="bg-card/60 flex flex-col rounded-3xl border p-5">
      <figure>
        <div className="flex h-48 items-center justify-center">{children}</div>
        <figcaption className="text-muted-foreground mt-2 text-center text-xs">
          {caption}
        </figcaption>
      </figure>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{body}</p>
    </article>
  );
}

function EvalCard({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: typeof Trophy;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card/60 hover:bg-card group flex flex-col rounded-3xl border p-5 transition-colors"
    >
      <Icon className="text-gold size-5" aria-hidden />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{body}</p>
      <span className="text-muted-foreground group-hover:text-foreground mt-auto flex items-center gap-1 pt-4 text-sm">
        Open <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-card/60 rounded-3xl border p-6">
      <div className="font-display text-4xl font-semibold tracking-tight">{value}</div>
      <p className="text-muted-foreground mt-1 text-sm">{label}</p>
    </div>
  );
}
