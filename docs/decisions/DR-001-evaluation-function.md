# DR-001: Evaluation function features and weights

- **Decision:** score positions with six hand-counted board features and fixed, hand-tuned weights (`weights.json`), from Red's point of view.
- **Status:** accepted in 2022 (team _4399, COMP30024 Part B). Recorded retrospectively on 6 October 2026 from the code; the 2022 report is not in the repository, so anything about our reasoning that the code does not show is marked as such.
- **Supersedes:** nothing. **Superseded by:** nothing yet.

## Context

The Part B agent needed a static evaluation for minimax leaves. It had to run inside the referee's CPU-time and memory limits (60 seconds and 100 MB per player when enabled) on Python 3.6, on boards from 3 × 3 to 15 × 15, and be explainable in the report. We had no training data and no self-play infrastructure, and about four weeks.

## Decision

`Eval(board)` returns a weighted sum of six features, each counted for Red and subtracted for Blue (except the shared empty-cell count):

| Feature | Weight | Sign |
| --- | --- | --- |
| Empty hexes (shared) | 0.5 | + |
| Tokens in a solid triangle with two adjacent friendly neighbours | 3 | + |
| Token count | 8 | + |
| Positional value (score matrix: rim high, centre low) | 2 | + |
| Tokens in a half-built diamond the opponent could complete | 4 | − |
| Tokens with an exposed gap (weak formation) | 3 | − |

A random ×(1 + 10⁻⁵) bias breaks ties between equal scores. The weights live in `coursework/Project Part B/code/utility/weights.json`, which the web port copies verbatim (a test checks the bytes).

## Options considered

What the code shows we built or started:

1. **Hand-tuned linear evaluation over pattern features** (chosen).
2. **A connection-distance feature.** `_4399/eval_func.py` contains `estimate_steps_to_win`, which uses our Part A A* search to estimate how many cells each side still needs. It is written but commented out of the feature list in `utility/evaluation.py`. The code does not record why; cost per leaf is the likely reason, but that was never measured.
3. **Learned weights** (for example, tuning against the random agent or by self-play). Not attempted; nothing in the repository suggests it was.

## Why

Pattern counts are cheap (one pass over the board), map directly onto the capture rule (diamonds) and onto shapes that are hard to capture (triangles), and are easy to explain in a report. Fixed weights let us change behaviour quickly by hand during development. The rationale for the specific numbers was "team empirical experience" (the code's own words); there is no record of a systematic search.

## What happened

Measured in October 2026 with the parity-tested TypeScript port (reference round robin, 1,200 games on 4 × 4 to 6 × 6, seed 2022; details on `/tournament`):

- Against the random agent the evaluation is clearly useful: the original agent won 106 of 120 games (88.3%, Wilson 95% CI 81.4% to 92.9%), and greedy one-ply on the same evaluation won 100 of 120 (83.3%, 75.7% to 88.9%). The original Python benchmark (144/160, 90.0%, 84.4% to 93.8%) agrees.
- Against agents that search, lookahead on the same evaluation is what wins: fixed depth 3 beat the original in 84 of 120 games. Used one ply deep, the evaluation does not separate the original from greedy one-ply at all (61 wins to 59).
- It has blind spots that are visible in the feature list. Nothing measures connection progress (the actual goal of the game), and the positional matrix rewards the rim over the centre, which is the opposite of standard Hex opening advice. Neither was tested in 2022.
- By construction, token count carries the largest weight (8 per token), so a capture (two tokens, 16 points) outweighs several shape features at once. Whether that balance is right was never tested.

## What I'd change

- Put connection distance back in, measured: add `estimate_steps_to_win` (or a cheaper two-distance or flow measure) and test it in the round-robin harness with colour-swapped pairs and intervals, rather than by feel.
- Tune weights against data instead of by hand: even a simple coordinate search over the six weights, scored by win rate against fixed opponents on held-out seeds, would make the numbers defensible.
- Report evaluation quality directly (for example, how often the evaluation ranks the eventual winner ahead after k moves), not only final win rates.
