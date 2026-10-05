# DR-005: Report uncertainty at the unit that was sampled

- **Decision:** every interval accounts for the unit that was actually sampled independently (positions, games, boards), every average is shown with the distribution it summarises when that distribution is lopsided, and every seeded interval is computed on data in a fixed order, so the same seed always gives the same numbers.
- **Status:** accepted on 6 October 2026, after a second review of the 2026 evaluation (PR #12).
- **Supersedes:** the pruning-ratio sentence in DR-002 ("visits between 92% and 100% of the nodes"), and the per-turn interval for the LLM arena described in DR-004. Both records stay as written; this record says what changed and why.

## Context

A second review found three places where the numbers on the site were correct but the way they were summarised said more than the data did.

1. **Alpha-beta.** DR-002, the agent card and the README said the original alpha-beta "visits 92% to 100%" of the full tree. That range is of the *averages* per board size, depth and move order. Individual searches range from under 1% to 100%, and the distribution is all-or-nothing: most searches prune nothing, and a few prune a lot.
2. **LLM arena.** The share of turns whose first answer was rejected had a Wilson interval that treated every turn as an independent trial. Turns in one game share the model, the prompt and an evolving position, and errors tend to repeat, so turns are clustered by game. The arena also showed each baseline's win rate next to the model's, with no paired comparison, although DR-004 lists the arena as a paired design.
3. **Tournament reproducibility.** With the same seed, the in-browser round robin played identical games, but the Bradley-Terry intervals and the order of rows in the games CSV changed between runs. Web Workers return games in the order they finish, and the seeded bootstrap indexes into the arrays in that order. Three runs at seed 4399 gave three different intervals for fixed depth 2: [199.2, 443.3], [187.9, 446.2] and [192.1, 437.2].

## Decision

- **Alpha-beta:** report the per-position distribution next to the averages (how many searches visited every node, and the range among those that pruned anything), and state the mechanism: with the bug, beta never drops below +infinity, so a cut-off can only happen once the search finds a line it scores as a forced win for Red.
- **LLM arena, rejected answers:** a Wilson interval on the effective number of turns, n / deff, where the design effect deff is the cluster-robust variance of the pooled rate (games as clusters) over its variance under independent turns, floored at 1. With one game the design effect cannot be estimated, and the site says the interval then treats turns as independent.
- **LLM arena, versus baselines:** for each baseline, the games won by only the model and by only the baseline, on the same seeds and colours, with an exact McNemar test.
- **Tournament:** sort game records into schedule order (board size, pairing, round, colour leg) before analysis and export. A run played one game at a time, like the reference run, is already in that order, so its numbers do not change.

## Options considered

1. **Keep the old summaries and add footnotes.** Cheapest, but a footnote does not stop a reader quoting "92% to 100%" as the range for any search, or reading a Wilson interval over 24 turns as if it came from 24 independent trials.
2. **Cluster bootstrap over games.** Resample whole games and recompute the pooled rate. I implemented this first, because it reuses the seeded bootstrap code. It fails in the wrong direction with few games: when every game happens to have the same rate (3 rejections in 6 turns, four times), every resample gives exactly 50%, a zero-width interval, which is far more confident than 24 independent turns would justify.
3. **Wilson interval with a design effect** (chosen for the arena). The design effect comes from the standard cluster-robust (linearised) variance of a ratio, which I checked against statsmodels' cluster-robust variance for an intercept-only regression. Flooring it at 1 means games that look alike never make the interval narrower than Wilson's over independent turns, while games that differ widen it. With 4 to 8 games the design effect is itself noisy, so the interval is a guide, not a guarantee.
4. **For the tournament, place each record in a slot by its schedule index inside the worker pool.** That fixes the browser, but any other caller could still pass records in another order. Sorting inside the analysis fixes every caller, including CSV export.

## Why

An interval is only as honest as its unit of analysis. Positions in the alpha-beta study, games in the arena and boards in the A\* study are the units drawn independently; turns within a game are not. A summary that is a range of averages should not be read as a range for single cases, especially when the underlying distribution is all-or-nothing. And a seed is only useful if it reproduces the numbers on the page, not just the games.

## What happened

- **Alpha-beta:** 444 of the 480 searches (92.5%) visited every node of the full tree. The 36 that pruned anything visited between 0.6% and 92% of it (canonical order down to 0.6%, shuffled order down to 12.5%). The averages, 92% to 100% per board size, depth and move order, are unchanged; so is the textbook comparison (17% to 45% on average). The weak number stands: the original's pruning saves almost nothing in almost every search.
- **LLM arena:** in a test with 12 rejected first answers in 24 turns, bunched in 2 of 4 games, the old Wilson interval was 31% to 69%. The design effect is 8, so the 24 turns carry about as much information as 3 independent ones, and the interval becomes 13% to 87%: that is what four games can say about a model that fails in some games and not others. With rejections spread evenly, the interval is the old one. The paired column makes the comparison DR-004 promised; with 4 games, McNemar can only flag a very large difference, and the caption says so. There are no real-provider results yet to compare before and after.
- **Tournament:** the same seed now gives identical intervals and an identical games CSV however the workers finish (tested by shuffling records). Two browser runs at seed 4399 both gave fixed depth 2 an interval of [202.7, 437.3]; the point estimates (302.4 for depth 2, 246.3 for the original, 237.1 for greedy) were already stable and did not change. The reference run's intervals, and every number quoted from it in the agent card and DR-004, are unchanged, because it was played in schedule order.

## What I'd change

- Write the unit of analysis down in the analysis plan before collecting data, alongside the sample size.
- Report the alpha-beta distribution as a small histogram on `/tournament` rather than in prose.
- For the arena, report rejected answers per game as well (the share of games with any rejection), which needs no clustering argument at all.
- Run enough games that the design effect can be estimated with some confidence (at least 10 to 20), and say so in the arena's default settings.
