# Documentation

| Document | What it covers |
| --- | --- |
| [model-card.md](model-card.md) | Agent card for the `_4399` minimax agent: intended use, provenance, evaluation with intervals, known weaknesses |
| [ai-use-statement.md](ai-use-statement.md) | What the optional bring-your-own-key AI features do and never do, data sent, human review and the audit log |
| [decisions/](decisions) | Decision records. A past record is never edited; a new record supersedes it. |

Decision records:

- [DR-001: Evaluation function features and weights](decisions/DR-001-evaluation-function.md)
- [DR-002: Dynamic depth allocation for minimax](decisions/DR-002-dynamic-depth-allocation.md)
- [DR-003: Port to TypeScript and run in Web Workers, verified by parity tests](decisions/DR-003-typescript-port-web-workers.md)

These files are rendered on the website under `/methods`. The site reads a synced copy in
`web/content/docs/` (the Vercel build only sees `web/`); run `pnpm sync-docs` in `web/` after
editing, and the test suite fails if the copies drift.
