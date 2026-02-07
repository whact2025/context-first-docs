# TruthLayer

**Ratify truth. AI with Guardrails for Security & Compliance.** TruthLayer is enterprise truth governance for humans and agents: a **truth ledger + collaboration layer** that lets you **ratify** truth with **guardrails** for AI. Agents read accepted truth and author proposals; humans review and apply. The system gives agents stable, typed context and a safe proposal path—they never hold review/apply authority.

The **canonical documentation lives in [docs/](docs/README.md)**. This README summarizes; for architecture, whitepaper, API, and scenarios, start there.

## In one sentence

TruthLayer is a **truth ledger + collaboration layer** (ACAL) designed for **humans and agents**. We **build an agent** that reads accepted truth and creates proposals; humans govern (review/apply) via one minimal governance UI. Canonical truth store (typed nodes + relationships), proposal/review/apply workflow, agent-safe API. Optional: rich clients (Web, VS Code, Office).

## Start here (docs are source of truth)

| If you want… | Go to (in docs/) |
|---------------|------------------|
| **Overview & invariant (ACAL)** | [docs/README.md](docs/README.md) |
| **Whitepaper** (problem, AI with Guardrails, security + compliance) | [docs/WHITEPAPER.md](docs/WHITEPAPER.md) |
| **Architecture** (Truth Store, Policy, Projection, Change Detection, Clients, Agent) | [docs/core/ARCHITECTURE.md](docs/core/ARCHITECTURE.md) |
| **Hello World** (proposal → review → apply) | [docs/scenarios/HELLO_WORLD_SCENARIO.md](docs/scenarios/HELLO_WORLD_SCENARIO.md) |
| **Conflict & Merge** | [docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md](docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md) |
| **Minimal governance UI** | [docs/core/UI_SPEC.md](docs/core/UI_SPEC.md) |
| **Agent API** (read truth, author proposals; no review/apply) | [docs/core/AGENT_API.md](docs/core/AGENT_API.md) |
| **How to use** | [docs/core/USAGE.md](docs/core/USAGE.md) |
| **Schema, security, operations** | [docs/reference/DATA_MODEL_REFERENCE.md](docs/reference/DATA_MODEL_REFERENCE.md), [docs/reference/SECURITY_GOVERNANCE.md](docs/reference/SECURITY_GOVERNANCE.md), [docs/reference/OPERATIONS.md](docs/reference/OPERATIONS.md) |

Full index: [docs/README.md](docs/README.md).

## Problem

Organizations suffer from **truth fragmentation**: the real decision lives in Slack, rationale is lost, **agents ingest stale or contradictory context**. TruthLayer is **AI with Guardrails for Security & Compliance**: a **truth ledger** (accepted revisions) and **collaboration layer** (proposals → review → **ratify** → apply) so truth is governable and **safe for both humans and agents**—agents get stable, accepted-only context and a clear proposal boundary; guardrails (RBAC, audit) keep AI in check for compliance.

## What we're building (per docs/)

- **The Agent** — We build an agent that uses the agent-safe API: reads accepted truth (queryNodes, traverseReasoningChain, etc.) and creates/updates proposals; it **cannot** submit reviews or apply. Humans govern. See [docs/core/AGENT_API.md](docs/core/AGENT_API.md), [docs/appendix/CONTEXTUALIZED_AI_MODEL.md](docs/appendix/CONTEXTUALIZED_AI_MODEL.md).
- **Truth Store** — Canonical graph (nodes + edges), accepted revisions ledger, proposals/reviews/apply artifacts.
- **Policy & Governance** — RBAC, approval rules, validation, audit logging.
- **Minimal Governance UI (required)** — Where humans list proposals, review, accept/reject, and apply. See [docs/core/UI_SPEC.md](docs/core/UI_SPEC.md).
- **Projection Engine** — Markdown/DOCX/HTML views; change detection turns edits into proposal operations.
- **Optional** — Rich clients (VS Code extension, web app, CLI, Office add-in); different deployment modes for the agent (in-process, API).

## Who this is for

Teams that want **AI with guardrails** for security and compliance: **agentic collaboration** over governed truth, immutable accepted truth, human **ratification** of every change, and a **clear agent boundary** (agents propose; humans ratify and apply). Security-conscious orgs (self-hostable, no data leak).

## Getting started

**Prerequisites:** Node.js 18+ (npm bundled). See [INSTALL_NODEJS.md](INSTALL_NODEJS.md) if needed.

```bash
node scripts/install.js
# or: npm run install:all
```

Manual: `npm install && npm run build && npm test`. [scripts/README.md](scripts/README.md).

**Playground:** `npm run playground` → http://localhost:4317. Scenario Runner (Hello World, Conflict and Merge); minimal governance UI at `/acal/proposals`.

## This repo (self-referential)

The project uses ACAL to document itself: [CONTEXT.md](CONTEXT.md), [DECISIONS.md](DECISIONS.md), [PLAN.md](PLAN.md), [RISKS.md](RISKS.md), [QUESTIONS.md](QUESTIONS.md). See [docs/appendix/SELF-REFERENCE.md](docs/appendix/SELF-REFERENCE.md).

## Status & more

- **Implementation:** [PLAN.md](PLAN.md); storage: [docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md](docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md).
- **Examples:** [examples/](examples/).
- **License:** MIT.
