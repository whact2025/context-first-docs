# Self-Reference (Dogfooding)

TruthLayer works best when it manages its own documentation as truth.

Recommended projections:
- `README.md` (overview)
- `DECISIONS.md`
- `PLAN.md`
- `RISKS.md`
- `QUESTIONS.md`

The canonical nodes track:
- product decisions
- architecture constraints
- implementation plan tasks
- risks + mitigations

This creates a tight loop:
Accepted truth → projections → edits → proposals → review/apply → new truth

Run the playground: **`npm run playground`** then open http://localhost:4317 (see repo README).
