# Context-First Docs for Agentic Development

## TL;DR
This project is **not a document editor**.

It looks like Markdown.  
It feels like Google Docs review mode.  
It behaves like a structured, auditable **context graph** that **humans and AI agents can safely reason over**.

Markdown is the interface.  
Context is the truth.

---

## The Problem

Modern development teams suffer from **context collapse**.

- Decisions live in Slack, Notion, PR comments, and half-remembered conversations
- README files drift out of sync with reality
- Git diffs show *what* changed, but not *why*
- AI agents hallucinate because they can't distinguish:
  - accepted truth vs proposals
  - rejected ideas vs current constraints
  - open questions vs resolved decisions

Word / Google Docs solve **human review**, but are opaque, non-deterministic, and hostile to Git and agents.

GitHub / GitLab solve **code review**, but lose semantic intent and decision provenance.

**There is no shared substrate for durable, reviewable, agent-safe context.**

---

## What We're Building

A **context-first collaboration system** with:

- Docs-style comments and tracked changes (accept / reject)
- Structured semantic nodes (goals, decisions, constraints, tasks, risks)
- Bidirectional Markdown ↔ context synchronization
- GitHub / GitLab as *projection targets*, not the source of truth
- First-class agent APIs for safe consumption and proposal generation
- VS Code/Cursor extension for in-editor review and context awareness
- Pre-baked Cursor rules for AI-assisted proposal and risk authoring
- Reverse engineering of merge requests/PRs to extract historical context
- Designated contributors and approvers with role-based access control
- Automatic action creation when proposals are approved

This is infrastructure for **long-lived, multi-human, multi-agent systems**.

---

## Core Idea

### Canonical Context Store
The system stores **meaning**, not blobs of text.

- Every concept is a typed node with identity and status
- Changes are represented as **proposals**, not diffs
- Accepting or rejecting a change is a **first-class decision**
- Rejected ideas are preserved for provenance

This is equivalent to Word / Docs tracked changes — but **explicit, structured, and queryable**.

---

### README-Style Markdown as a Projection
Humans interact through familiar files:

- `README.md`
- `CONTEXT.md`
- `DECISIONS.md`
- `PLAN.md`
- `RISKS.md`

Semantic sections are wrapped in lightweight `ctx` blocks with stable IDs.

Humans can:
- read them on GitHub / GitLab
- edit them locally
- review them in PRs / MRs

The system:
- imports edits as **proposals**
- exports accepted truth back to Markdown **deterministically**
- rewrites only the sections it owns

Normal Git workflows continue to work.

---

### Docs-Like Review Semantics
Instead of line-based diffs:

- Insertions, deletions, and edits are **tracked changes**
- Reviewers accept or reject changes per proposal or per operation
- Comments attach to **semantic text ranges**, not line numbers
- Review state survives rebases, merges, and time

This is how Word / Docs behave — but grounded in Git-friendly structures.

---

## Agent-Safe by Design

Agents **never read raw Markdown**.

They consume:
- accepted truth
- open proposals
- unresolved questions
- decision and rejection history

Agents can:
- propose changes
- open comment threads
- generate plans or tasks

Agents **cannot mutate truth directly**.

This eliminates hallucinated state and context drift.

---

## Why This Matters

This enables things that are currently fragile or impossible:

- Architectural decisions that don't rot
- README files that reflect reality
- Agents that understand what is decided vs under discussion
- Automatic task and plan generation from unresolved context
- Auditable reasoning: *why* something exists, not just that it does

This is a foundation for **trustworthy agentic development**.

---

## What This Is *Not*

This is not:
- a wiki
- a note-taking app
- a Markdown editor
- a Notion clone
- a replacement for code review

It is a **semantic context layer** that:
- projects into Markdown
- integrates with Git
- supports human review
- and is consumable by AI agents without guesswork

---

## Who This Is For

- Engineers tired of design decisions disappearing
- Teams building agentic systems
- Platform and infra teams that care about auditability
- Open-source projects with long decision histories
- Anyone who has said:

> "The README lies, the PR is merged, and nobody remembers why."

---

## Direction

- Correctness over flash
- Deterministic behavior over clever heuristics
- Review semantics before realtime polish
- Agent safety before convenience

VS Code/Cursor extension is required for v1 to enable in-editor review and context awareness. Realtime collaboration is additive.

---

## Why Contribute

This is one of those rare problems where:
- the pain is real
- the gap is obvious
- existing tools fundamentally don't fit
- and the solution becomes *more valuable* in an AI-heavy future

If you care about:
- Git
- long-lived context
- decision provenance
- or building tools that will remain useful in 5+ years

…this is worth building.

---

## Self-Referential Documentation

**This project uses its own context-first system to document itself.**

The project's documentation is managed through the context-first system:

- [`CONTEXT.md`](CONTEXT.md) - Core project context and goals
- [`DECISIONS.md`](DECISIONS.md) - Architecture decisions with rationale
- [`PLAN.md`](PLAN.md) - Development roadmap and tasks
- [`RISKS.md`](RISKS.md) - Project risks and mitigation strategies
- [`QUESTIONS.md`](QUESTIONS.md) - Open questions needing answers

These files use `ctx` blocks to embed semantic nodes. The system imports edits as proposals, manages review, and exports accepted truth back to Markdown.

This demonstrates the approach in practice - if we can't use our own tool effectively, we shouldn't expect others to.

See [`docs/SELF-REFERENCE.md`](docs/SELF-REFERENCE.md) for details on how this works, and [`PROJECT-STRUCTURE.md`](PROJECT-STRUCTURE.md) for an overview of the project organization.

## Getting Started

```bash
npm install
npm run build
npm test
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

## Examples

See the [`examples/`](examples/) directory for non-self-referential examples of using the system.

## License

MIT
