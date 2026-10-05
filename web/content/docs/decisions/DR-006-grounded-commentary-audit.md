# DR-006: Ground commentary in what the search found, and keep the check with the decision

- **Decision:** the move commentator is told what the score means at the depth searched (the feature breakdown explains the score only for a one-ply search, and a forced win is the reason for a move, not the features), its automatic grounding check tests that, and the check's result is stored in the audit-log entry for the call, so it is shown and exported next to the human decision.
- **Status:** accepted on 6 October 2026, after a second review of the 2026 evaluation (PR #12).
- **Supersedes:** nothing. It extends the human-in-the-loop design in the AI use statement.

## Context

The commentator turns the agent's own numbers for one move into plain English, and a grounding check compares the reply with those numbers. A review found three gaps.

1. **The facts mixed two scopes.** They paired the chosen score, which at depth 2 or more is the backed-up minimax value (or plus or minus infinity for a forced win), with a feature breakdown of the position one ply after the move. The prompt asked the model to explain "which evaluation features pushed the score". On 4 × 4, seed 76, the original agent as Red searched 3 plies and found a forced win, while the one-ply features summed to −12, favouring Blue. A model that followed the prompt would attribute a forced win to features that point the other way, and every check would still pass, because every number and move it cited was in the input.
2. **The shared feature could not be described correctly.** The empty-hex term adds the same amount whoever moved, so its contribution is always positive. A model that called it neutral, which is right, failed the direction check.
3. **The check was not in the audit trail.** It was shown in the panel and then discarded. A reviewer deciding later on `/ai-log` never saw it, and an exported log could not show that accepted commentary had failed its check, which is the evidence the human-in-the-loop claim rests on.

## Decision

- Add `score_scope` to the facts: one sentence, chosen by the depth and score, that says how the score relates to the features. Add `search.forced_win` (Red, Blue or none), and a note on the shared feature saying it is neutral and does not separate the candidates.
- Rewrite the prompt so the model reads `score_scope` first: report a forced win plainly, never present the features as the source of a depth-2+ score, and explain the features only for a one-ply search.
- Add a fifth check, "Forced wins reported as the search found them": the summary must mention a forced win when the search found one, must not give it to the wrong player, and must not claim one the search did not find (a denial such as "no forced win" is fine). Accept neutral for shared features.
- Store `{ passed, checks }` in the audit entry, written once with the output by the call itself, not by the panel afterwards. Export it as `grounding_passed` and `grounding_failures` in CSV and in full in JSON. On `/ai-log`, show it above the review buttons (open when it failed), flag failed entries next to the decision, and count them. Entries logged before this change are re-checked from the logged prompt, labelled as recomputed, and the recomputed check is stored when the reviewer decides.

## Options considered

1. **Drop the feature breakdown for depth 2+.** Removes the mismatch, but also removes the only facts that describe the position, and the breakdown is still true of the position after the move.
2. **Send the features of the position at the end of the principal variation.** That is what the score actually summarises, but the agent does not record its principal variation, and changing the agent's search to record it would change the code that is being explained.
3. **Label the scope and check it** (chosen). The facts stay the agent's own numbers, the model is told what they mean, and the check catches the specific failure the review found.
4. **Store the check in the panel's state only, and add a field later.** That is how it was, and it is why a later reviewer could accept failed commentary without knowing.

## Why

A grounding check that only verifies that cited numbers exist in the input can pass a confidently wrong explanation built from true numbers. The facts have to say what the numbers mean, and the check has to test the claim that matters most, here whether the move was a forced win. And an audit trail is only evidence of human oversight if it records what the human saw when deciding, including an automated warning they chose to override.

## What happened

- The seed-76 position is now a regression test. A reply that explains the move through the features alone passes the old four checks and fails the new one; a reply that reports the forced win for Red passes; one that gives it to Blue fails.
- The check is stored with every new commentary call and appears in both exports; a test accepts commentary that failed the wrong-player check and confirms the CSV row says so.
- The fifth check is narrow by design. It looks for "forced win", "forces a win" and similar phrases, so a model that describes a forced win in other words would fail it and need a human decision; I would rather have that false alarm than a silent pass.
- None of this has been run against a real provider yet; it is tested against mocked replies. How often real models trip the new check is unknown.

## What I'd change

- Record the agent's principal variation, so the commentator can describe the position the score actually comes from (option 2), as a new agent variant rather than a change to the original.
- Run a small labelled evaluation of the grounding check itself (replies written to pass and to fail), and report its false-alarm and miss rates with intervals.
