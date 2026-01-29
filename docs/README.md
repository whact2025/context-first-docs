# Documentation

This folder contains the main documentation for Context-First Docs (ACAL).

## Canonical scenario files (include in any doc deliverable)

**Concurrency is where systems like this either become magical—or become "merge wars 2.0."** The whitepaper and appendix reference two **canonical day-in-the-life** walkthroughs. **Include both** in any doc set you ship to builders:

| File | Purpose |
|------|---------|
| **[HELLO_WORLD_SCENARIO.md](HELLO_WORLD_SCENARIO.md)** | Basic lifecycle: accepted graph → proposal → review (anchored comments) → accept/apply → regenerated Markdown. |
| **[CONFLICT_AND_MERGE_SCENARIO.md](CONFLICT_AND_MERGE_SCENARIO.md)** | Parallel authoring: conflict detection, field-level merge (mergeable vs conflicting), stale proposal (optimistic locking). Same style as Hello World—concrete proposal JSON and outcome shapes. |

Without the second file, concurrency is described (e.g. whitepaper §5.3.4) but builders lack the same canonical-scenario treatment as Hello World. With both, the doc set is **complete** for builders.

Run **hello-world**, **conflicts-and-merge**, and **stale-proposal** in the playground Scenario Runner (`npm run playground`) to reproduce.

## Other key docs

- **WHITEPAPER.md** — Full design, product wedge, implementation status, security (§7), status model (§4.1).
- **CONTEXTUALIZED_AI_MODEL.md** — **Contextualize module** (first-class): RAG, fine-tuning, structured prompting; **prompt-leakage policy layer** (policy-as-code: labels, retrieval policy, logging); accepted-only = same safety contract as collaboration.
- **REVIEW_MODE.md** — Proposal → review → apply invariant.
- **AGENT_API.md**, **RECONCILIATION_STRATEGIES.md**, **UI_SPEC.md**, **USAGE.md** — API, conflict strategies, UI, usage.
