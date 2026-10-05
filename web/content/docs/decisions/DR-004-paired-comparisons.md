# DR-004: Compare two methods by their paired difference

- **Decision:** whenever two methods are measured on the same units, report the difference between them with its own interval (and, for pass/fail outcomes, an exact paired test), rather than two separate intervals whose overlap the reader has to judge.
- **Status:** accepted on 6 October 2026, during review of the 2026 evaluation. Applies to the tournament, the A\* study and the LLM arena.
- **Supersedes:** nothing. It changes how the comparisons behind DR-002 are presented on the site, not what DR-002 records.

## Context

The first version of the 2026 evaluation showed some comparisons as two separate 95% intervals. Manhattan's and Euclidean's shortest-path rates were each given a Wilson interval, although both were measured on the same 931 boards. Two agents' Bradley-Terry strengths were compared by whether their intervals overlapped, although both come from one fit anchored to the same agent, so their errors are correlated. A review pointed out that neither display answers the question being asked, which is how far apart the two methods are.

The LLM arena had a related problem. When a run stopped early (the visitor pressed Stop, or the provider rate-limited the key), the model's row covered only the games it finished, while the baseline rows still covered the whole schedule. The caption said the seeds were the same for every row, and they were not.

## Decision

- **Agent strengths:** compare two agents through the difference of their Elo strengths, with a percentile interval taken from the same stratified bootstrap refits as the leaderboard (1,000 resamples, seed 2022 for the reference). The differences are shown in their own table on `/tournament` and in the summary CSV.
- **Pass/fail outcomes on shared units:** report the difference in rates with a paired bootstrap interval that resamples the units (boards), plus an exact McNemar test on the discordant units. The separate Wilson intervals stay, labelled as describing each method on its own.
- **LLM arena:** replay the baselines on exactly the games the model finished, and say so in the caption, including when colours end up unbalanced. Count rejected answers per turn (first answer only), with illegal moves and replies that carry no usable move reported separately, under one rule and one token budget for both providers.

## Options considered

1. **Keep the separate intervals and add a note.** Cheap, but it leaves the reader to make a comparison the intervals cannot support: overlapping 95% intervals do not imply no difference, and correlated estimates make overlap even less informative.
2. **Newcombe's or Tango's closed-form interval for a paired difference in proportions.** Good coverage properties, but I could not verify an implementation against a reference package offline, and an unverified formula is worse than none.
3. **Paired bootstrap plus exact McNemar** (chosen). The bootstrap reuses the seeded, tested resampling code, and the exact McNemar test is a two-sided binomial test that I verified against scipy, statsmodels and R.

## Why

The design decides the analysis. The A\* study and the tournament were built as paired designs (same boards, same seeds, colour-swapped pairs), so presenting them as if the arms were independent threw away the main advantage of the design. For a pass/fail outcome on shared units, only the units where the methods disagree carry information about the difference, and McNemar's test uses exactly those. For strengths fitted together, the interval of the difference must come from the same replicates, so the correlation is accounted for.

## What happened

- **A\*:** on the same boards Manhattan found a shortest path 11.3 percentage points less often than Euclidean (paired 95% bootstrap CI 9.1 to 13.3). Of the 107 boards where only one heuristic was optimal, it was Manhattan on 1 and Euclidean on 106 (exact McNemar p ≈ 1.3 × 10⁻³⁰). The separate intervals pointed the same way; the paired analysis is far sharper, because the 824 boards on which the heuristics agree say nothing about the difference.
- **Tournament:** the original minus greedy one-ply is +15 Elo (95% CI −24 to +56), so DR-002's "no detectable difference" stands, now on the right evidence. Fixed depth 3 minus the original is +151 Elo (106 to 195). Fixed depth 2 minus the original is +30 Elo (−11 to +70): not detectable either way.
- **LLM arena:** a run stopped after one game now compares one game with one game, and the caption says the colours are unbalanced. Truncated and refused replies are no longer counted as illegal moves.
- No original result changed. The per-agent intervals are identical to before, because the bootstrap replicates are the same; only the differences are new.

## What I'd change

- Write the comparisons down before running the study, so that the paired analysis is part of the plan rather than added after a review.
- Resample colour-swapped pairs, which are the design unit of the round robin, rather than single games.
- Add a closed-form paired interval (Tango's score interval) as a cross-check once it can be verified against a reference implementation.
