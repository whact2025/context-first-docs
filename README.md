# TruthLayer

**Agentic Collaboration Approval Layer (ACAL)** — a structured, review-mode **solution model** (typed graph of goals, decisions, tasks, risks, questions) that humans and AI agents collaborate on and **approve into truth**. Not a document editor; not just for software.

- **Looks like** Markdown. **Feels like** Google Docs “Suggesting” mode. **Behaves like** proposal → review → apply; Markdown (and DOCX export) are projections, not the store.
- **🔒 IP stays in your organization** — file-based (Git) or self-hosted MongoDB; no external services.

---

## Start Here

| If you want… | Go to |
|--------------|--------|
| **Hello World** (proposal → review → apply → Markdown) | [HELLO_WORLD_SCENARIO.md](docs/HELLO_WORLD_SCENARIO.md) |
| **Conflict & Merge** (parallel editing, field-level merge, staleness) | [CONFLICT_AND_MERGE_SCENARIO.md](docs/CONFLICT_AND_MERGE_SCENARIO.md) |
| **Change Detection** (how ctx blocks become proposals) | [CHANGE_DETECTION.md](docs/CHANGE_DETECTION.md) |
| **Reconciliation** (v1 default policy and overrides) | [RECONCILIATION_STRATEGIES.md](docs/RECONCILIATION_STRATEGIES.md) |
| **Whitepaper + Appendix** (why, contract, product wedge) | [WHITEPAPER.md](docs/WHITEPAPER.md) · [WHITEPAPER_APPENDIX.md](docs/WHITEPAPER_APPENDIX.md) |
| **Contextualized AI** (RAG, fine-tuning, prompt-leakage policy) | [CONTEXTUALIZED_AI_MODEL.md](docs/CONTEXTUALIZED_AI_MODEL.md) |

Full system design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Problem

Context is scattered (chat, PRs, wikis, tickets); **truth status** is ambiguous (drafts vs accepted vs rejected). AI agents then hallucinate or use outdated context because they can’t tell what’s approved. Word/Docs give review UX but are opaque to agents and often cloud-bound; Git/PRs don’t preserve semantic intent. **TruthLayer** is a single substrate: review-mode semantics, explicit accepted/proposed/rejected state, deterministic projection, and provenance of rejected ideas — with data staying self-hosted.

**Benefits even without agents:** Less decision churn, faster onboarding, auditable rationale, fewer rediscoveries of rejected alternatives, and a stable truth layer independent of ticket lifecycles.

---

## What We're Building

- **Solution model store** — Typed graph (goal → decision → task → risk → question); nodes and relationships; status (accepted / proposed / rejected).
- **Review mode** — No direct edits to accepted context; all changes are **proposals** → review → **apply**. See [REVIEW_MODE.md](docs/REVIEW_MODE.md).
- **Markdown and DOCX as projections** — Optional authoring via `ctx` blocks; deterministic `projectToMarkdown`; DOCX export for distribution (`scripts/build-whitepaper-docx.js`); store is source of truth.
- **Storage** — In-memory (today); file-based JSON graph (planned default); self-hosted MongoDB (planned production). Same `ContextStore` interface; all data in your perimeter.
- **Agent API** — Query by type, status, keyword, relationships; **decision/rationale traversal** (provenance chains: goal → decision → task → risk). Default: accepted-only reads. [AGENT_API.md](docs/AGENT_API.md).
- **Conflict reconciliation** — V1 default: field-level merge + optimistic locking + manual resolution for same-field conflicts; block approval on conflicts for decision/constraint nodes. [RECONCILIATION_STRATEGIES.md](docs/RECONCILIATION_STRATEGIES.md).
- **Contextualize module** — RAG, fine-tuning, structured prompting; **prompt-leakage policy layer** (labels, retrieval policy, logging). TS for store-facing; Python for embeddings/vector index/fine-tuning. [CONTEXTUALIZED_AI_MODEL.md](docs/CONTEXTUALIZED_AI_MODEL.md).
- **Clients** — VS Code/Cursor extension, web UI, CLI, agents (all speak the same store API).

---

## Jira (and similar)

**Jira** = execution (backlogs, boards, SLAs, delivery). **TruthLayer** = solution modeling and approval (decisions, constraints, risks, questions, review-mode truth). Use both: e.g. Jira issues reference node IDs (`decision-015`, `risk-001`); approved proposals can auto-create issues.

---

## Who This Is For

Security-conscious teams that want agentic development without IP leakage; engineers who want decisions and rationale to persist; organizations that can’t send context to external AI. For anyone who’s said: *“The README lies, the PR is merged, and nobody remembers why.”* or *“We can’t use AI tools because they’ll leak our IP.”*

---

## Getting Started

**Prerequisites:** Node.js 18+ (npm bundled). No Node? See [INSTALL_NODEJS.md](INSTALL_NODEJS.md).

```bash
# Recommended
node scripts/install.js
# or
npm run install:all
```

Manual: `npm install && npm run build && npm test`. More options: [scripts/README.md](scripts/README.md).

**Playground:** `npm run playground` → http://localhost:4317. Scenario Runner runs the [Start Here](docs/HELLO_WORLD_SCENARIO.md) scenarios (hello-world, conflicts-and-merge, stale-proposal); ACAL UI at `/acal` for graph, proposals, diff view, comments.

---

## This Repo (Self-Referential)

The project uses ACAL to document itself: [CONTEXT.md](CONTEXT.md), [DECISIONS.md](DECISIONS.md), [PLAN.md](PLAN.md), [RISKS.md](RISKS.md), [QUESTIONS.md](QUESTIONS.md) use `ctx` blocks and review-mode workflow. See [docs/SELF-REFERENCE.md](docs/SELF-REFERENCE.md).

---

## Status & More

- **Implementation status:** [PLAN.md](PLAN.md); storage gap analysis: [STORAGE_IMPLEMENTATION_PLAN.md](docs/STORAGE_IMPLEMENTATION_PLAN.md).
- **Examples:** [examples/](examples/).
- **License:** MIT.
