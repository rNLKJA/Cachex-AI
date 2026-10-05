# DR-002: Dynamic depth allocation for minimax

- **Decision:** search one ply while at least 15% of cells are empty, then deepen to 2, 3 and 4 plies as the empty share falls below 15%, 10% and 5%, after a hard-coded opening and an instant-win check.
- **Status:** accepted in 2022 (team _4399). Recorded retrospectively on 6 October 2026. The agent on the website still plays exactly this.
- **Supersedes:** nothing. **Superseded by:** nothing yet.

## Context

The referee could enforce a CPU-time limit per player for the whole game (60 seconds when enabled) on boards up to 15 × 15, and our minimax copied the whole board (`deepcopy`) at every node, so search cost grew quickly with depth and board size. We needed a rule for how deep to search that would not time out on large boards, but would look further ahead when the game was close to decided.

## Decision

`dynamic_depth_allocation` in `_4399/player.py`:

| Empty cells | Depth |
| --- | --- |
| ≥ 15% | 1 |
| 10% to 15% | 2 |
| 5% to 10% | 3 |
| < 5% | 4 |

Before any search, the agent plays a fixed opening on turns 1 and 2 (always cell (1, 1), stealing it as Blue if Red took it) and takes any immediately winning move.

## Options considered

1. **A fixed depth** (2 or 3 throughout). Simple, but at n = 15 a fixed depth 3 with full board copies would not have met the time limit.
2. **Iterative deepening with a time budget.** The robust textbook answer; it needs move ordering and a clock, and we did not build it.
3. **Depth by empty-cell ratio** (chosen): cheap, predictable and safe on large boards.

## Why

The ratio rule guaranteed we would not time out on big boards, and the intuition was that the endgame, with few empty cells, is where exact lookahead pays off and is also cheapest. It needed no timing code.

## What happened

Measured in October 2026 (reference round robin, 1,200 games on 4 × 4 to 6 × 6, 40 colour-swapped games per pairing per size, seed 2022; alpha-beta study on 120 positions; details on `/tournament`):

- **The deeper searches almost never run.** Over the whole tournament the original agent searched deeper than one ply on 34 of 4,602 searched moves (0.7%). Most games are decided before fewer than 15% of cells are empty.
- **So the agent is, in practice, greedy one-ply with an opening book.** Head to head with greedy one-ply it won 61 and lost 59 (50.8%, Wilson 95% CI 42.0% to 59.6%). Bradley-Terry strengths (Elo scale, random = 0): original 339 (95% bootstrap CI 290 to 396) against greedy 324 (274 to 386). No detectable difference.
- **Depth does matter.** Fixed depth 3 beat the original in 84 of 120 games (70.0%, 61.3% to 77.5%) and rates 490 Elo (432 to 559). Fixed depth 2 sits between them at 369 (321 to 427), and its head-to-head with the original (65 of 120 for depth 2) is not decisive.
- **Depth is expensive partly because of a bug.** The alpha-beta search visits between 92% and 100% of the nodes that plain minimax visits. In the minimising branch `if beta <= min_score: beta = min_score` can only raise beta, so the window never narrows there. Results are still correct (all 480 test searches returned the same root value as plain minimax), but a textbook update (`beta = min(beta, min_score)`) would visit 18% of the tree instead of 95% on 6 × 6 at depth 3, roughly a fivefold saving.
- The cost of depth 3 in the tournament was about 27 ms per move against 0.1 ms for the original (TypeScript port on an Apple M4; the 2022 Python is much slower).

## What I'd change

- Fix the beta update first. It is one line, it keeps results identical, and it makes deeper search several times cheaper.
- Replace the ratio thresholds with iterative deepening under a per-move time budget, with move ordering from the previous iteration, so the agent searches as deep as the clock allows on every move rather than only in the endgame.
- Choose thresholds or budgets by experiment, using this harness: colour-swapped pairs, fixed seeds, Wilson and bootstrap intervals, and a pre-registered comparison against the current agent.
- Keep this record: the original thresholds stay on the site as the "as submitted" agent, and any change ships as a new variant with its own row in the tournament.
