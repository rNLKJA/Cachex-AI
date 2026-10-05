# AI use statement

This site has two optional features that call a large language model. Everything else,
including the agent you play against and every statistic on the site, is ordinary code
that runs without any AI service. This statement is informed by the Australian Government's
policy for the responsible use of AI in government (Digital Transformation Agency), the
transparency principles of the EU AI Act, and the NIST AI Risk Management Framework. It is
not a claim of compliance or certification with any of them.

## What the AI features do

1. **Move commentator** (on `/play` and `/spectate`). When the minimax agent has searched for
   a move, you can ask a model to explain it in plain English. The model receives only the
   agent's own numbers for that move: board size, turn, the move, search depth, nodes visited,
   the top candidate scores and the six evaluation features with their weights and
   contributions. It is instructed to use nothing else.
2. **LLM as a player** (on `/llm-arena`). A model plays a few short games against the original
   agent. Each turn it receives the rules, the board, the move history and the list of legal
   moves, and returns one move as JSON. Answers are scored the same way for both providers, under
   the same output-token budget: an illegal move, or a reply with no usable move (malformed, cut
   off at the token limit, or refused), is rejected and asked again, up to three times. The
   headline is the share of turns whose first answer was rejected, reported next to random,
   greedy and scripted baselines on the same seeds.

## What they never do

- They never choose the agent's moves, change its evaluation, or feed into the tournament,
  the A* study or any other statistic on the site.
- They never run unless you add your own API key and press a button.
- They never send anything to this site's operators. The site is static and has no server;
  calls go directly from your browser to the provider you chose.
- They never store your key anywhere except your own browser (session storage by default,
  local storage only if you tick "remember on this device"), and never write it to the audit
  log or to any file in the repository.

## Data sent to the provider

Only the prompt shown in the audit log for that call: game state, rules, legal moves and, for
the commentator, the agent's evaluation breakdown. No personal information is collected or
sent. Your API key goes in the request header to the provider (Anthropic or OpenAI), which
processes the request under its own terms and bills your account.

## Human in the loop and transparency

- Every model output on the site is labelled **AI-generated** with the model name.
- Commentary is checked automatically against the facts it was given: cited feature
  directions must match the sign of their contribution, every number and move it mentions
  must appear in the input, and if it says which player moved, that must be the player who did.
  The result of that check is shown next to the text.
- You review each commentary and record a decision: accept, edit (your edit is stored next to
  the original) or reject. Commentary you did not review where it appeared (for example because
  the game moved on) stays "awaiting review" and can be decided later on `/ai-log`.
- Every call, successful or not, is recorded in the AI audit log at `/ai-log` with its
  timestamp, feature, provider, model, exact input, output (including the raw reply when it
  failed validation, was cut off or was refused), latency, token usage when the provider reports
  it, and your decision. Automated evaluation calls (the LLM player) are
  marked "n/a". The log stays in your browser and can be exported as JSON or CSV, or cleared.

## Known limitations

- A model can still misdescribe the facts in ways the automatic check does not catch (for
  example, emphasis or causal language). The check is a guard, not a guarantee; that is why
  the human decision exists.
- LLM-as-a-player results from a handful of games have wide intervals and depend on the
  model, the prompt and the day. Treat them as a demonstration of the evaluation method, not
  as a ranking of models.
