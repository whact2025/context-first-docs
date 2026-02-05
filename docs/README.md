# Documentation

This folder contains the main documentation for TruthLayer (ACAL).

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
- **WHITEPAPER_APPENDIX.md** — Deep technical excerpts and API references; glossary and comparison in main whitepaper (§11, §6.9).
- **CONTEXTUALIZED_AI_MODEL.md** — **Contextualize module** (first-class): RAG, fine-tuning, structured prompting; **prompt-leakage policy layer** (policy-as-code: labels, retrieval policy, logging); accepted-only = same safety contract as collaboration.
- **REVIEW_MODE.md** — Proposal → review → apply invariant.
- **AGENT_API.md**, **RECONCILIATION_STRATEGIES.md**, **UI_SPEC.md**, **USAGE.md** — API, conflict strategies, UI, usage.

## Storage, change detection, and reference

| File | Purpose |
|------|---------|
| **[CHANGE_DETECTION.md](CHANGE_DETECTION.md)** | How ctx-block and Markdown edits become proposals; diffing and import. |
| **[STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md)** | Dual storage options (file-based vs MongoDB), abstraction layer, node text fields. |
| **[STORAGE_IMPLEMENTATION_PLAN.md](STORAGE_IMPLEMENTATION_PLAN.md)** | Gap analysis, implementation tasks, and timeline for storage backends. |
| **[DOCX_REVIEW_INTEGRATION.md](DOCX_REVIEW_INTEGRATION.md)** | Using DOCX/Word/Excel as a review surface (native vs Office Add-in). |
| **[SELF-REFERENCE.md](SELF-REFERENCE.md)** | How this project uses ACAL to document itself (CONTEXT.md, DECISIONS.md, etc.). |
| **[DOCS_ANALYSIS.md](DOCS_ANALYSIS.md)** | Inconsistencies and gaps analysis; link convention and index. |

**Link convention:** From within `docs/`, link to other docs in this folder by filename only (e.g. `[Whitepaper](WHITEPAPER.md)`). Link to repo-root files with `../` (e.g. `../DECISIONS.md`, `../CONTEXT.md`). This keeps links valid whether the reader is at repo root or serving from `docs/`.
