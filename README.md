# Context-First Docs for Agentic Development

## TL;DR
This project is **not a document editor**.

It looks like Markdown.  
It feels like Google Docs review mode.  
It behaves like a structured, auditable **context graph** that **humans and AI agents can safely reason over**.

**🔒 Project context and IP never leak outside your organization** - all data stays in your Git repository (file-based) or self-hosted MongoDB (production), complete organizational control.

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
- **Privacy concerns**: Using external AI tools risks leaking sensitive project context and IP

Word / Google Docs solve **human review**, but are opaque, non-deterministic, hostile to Git and agents, and often require cloud services.

GitHub / GitLab solve **code review**, but lose semantic intent and decision provenance.

**There is no shared substrate for durable, reviewable, agent-safe context that keeps your IP secure.**

---

## What We're Building

A **context-first collaboration system** with:

- **Graph-based context store**: Nodes with typed relationships (goal → decision → task → risk)
- **Dual storage options (planned)**: File-based (JSON graph in a repo) for development/small projects, MongoDB (self-hosted) for production/scaling
- **Storage abstraction**: Both implementations use same `ContextStore` interface - start simple, scale up seamlessly via configuration
- **Review-mode semantics**: No direct edits to accepted context; all writes are proposals that are accepted/rejected into truth
- **Markdown as a projection**: ctx blocks are an optional authoring/projection format (can live in a repo or in a client)
- **Change capture**: Can happen in clients or an API; the store enforces review-mode invariants
- **Structured semantic nodes**: Goals, decisions, constraints, tasks, risks, questions with typed relationships
- **Bidirectional synchronization**: Markdown ↔ context store (client/API-driven; not line-diff-based Git workflows)
- **First-class agent APIs**: Comprehensive query API with chain-of-thought traversal for reasoning through contexts
- **Clients**: VS Code/Cursor extension, web UI, CLI, or agents (all are clients of the same store API)
- **Pre-baked Cursor rules**: AI-assisted proposal and risk authoring
- **Reverse engineering**: Extract historical context from merge requests/PRs
- **Role-based access control**: Designated contributors and approvers with permissions
- **Automatic issue creation**: Issues created when proposals are approved
- **Hybrid conflict reconciliation**: Automatic detection, field-level merging, optimistic locking, manual resolution
- **🔒 Zero IP Leakage**: All project context and IP stays within your organization
  - **File-based option**: All data in Git repository (self-hosted GitLab, Gitea, etc.)
  - **MongoDB option**: All data in self-hosted MongoDB (within organization)
  - **Self-hosted infrastructure**: All storage options self-hosted, no external cloud services
  - **Git integration**: File-based uses Git directly, MongoDB uses periodic Git snapshots for backup
  - No external cloud services required
  - No data sent to external APIs
  - Complete organizational control over data location and access
  - Supports air-gapped deployments

This is infrastructure for **long-lived, multi-human, multi-agent systems** where **privacy and IP protection are critical**.

## How this complements Jira (and similar tools)

Jira is excellent at **execution management**: backlogs, boards, workflows, reporting, and cross-team coordination.

Context-First Docs focuses on **durable, agent-safe context** that Jira tickets often fail to preserve:

- **Canonical “why” graph**: Goals/decisions/risks/questions are first-class typed nodes with relationships (goal → decision → task → risk).
- **Proposals + provenance**: Accepted truth vs proposed changes vs rejected ideas are explicit and reviewable (not buried in comments).
- **Agent-safe semantics**: Agents can query accepted truth and traverse reasoning chains without guessing what’s current.
- **Privacy-first storage**: Context stays self-hosted (Git or MongoDB), supporting zero IP leakage and air-gapped use.

### Recommended division of responsibilities

- **Use Jira for**: sprint planning, assignment, SLAs, workflows/automation, time tracking, delivery reporting.
- **Use Context-First Docs for**: decision records, constraints, rationale, risks/mitigations, long-lived plans, and structured context that links to code and to Jira items.

In practice: a Jira issue can reference a stable node ID (e.g., `decision-015`, `risk-001`), and approved proposals can auto-create issues—letting Jira manage execution while this system manages truth and reasoning.

---

## Core Idea

### Canonical Context Store
The system stores **meaning**, not blobs of text.

- Every concept is a typed node with identity and status
- **Graph model**: Nodes form a graph with typed relationships (parent-child, depends-on, references, implements, blocks, etc.)
- **Dual storage options**: File-based (JSON Graph in Git) for development, MongoDB (self-hosted) for production
- **Storage abstraction**: Both use same `ContextStore` interface - start simple, scale up seamlessly
- Changes are represented as **proposals**, not diffs
- Accepting or rejecting a change is a **first-class decision**
- Rejected ideas are preserved for provenance
- **🔒 All data stays within organization**: Self-hosted, **zero IP leakage**
  - **File-based**: All data in Git repository (self-hosted GitLab, Gitea, etc.)
  - **MongoDB**: All data in self-hosted MongoDB (within organization)
  - **GraphQL API**: Type-safe, self-documenting API (works with both storage backends)
  - All context stays within your organization
  - No cloud services, no external APIs
  - Complete control over data location and access
  - Air-gapped deployments supported

This is equivalent to Word / Docs tracked changes — but **explicit, structured, queryable, graph-native, and privacy-preserving**.

---

### README-Style Markdown as a Projection
Humans can interact through familiar Markdown files (in-editor, in a web UI, or in a repo):

- `README.md`
- `CONTEXT.md`
- `DECISIONS.md`
- `PLAN.md`
- `RISKS.md`

**Important**:
- Markdown is a **projection format**, not the canonical truth store.
- Accepted truth is changed only via **accepted proposals** (see `docs/REVIEW_MODE.md`).
- Where Markdown lives (repo vs client) and how the store persists (file-based vs DB) are deployment choices.

Semantic sections are wrapped in lightweight `ctx` blocks with stable IDs.

Humans can:
- edit Markdown files in UI (VS Code/Cursor extension, web UI)
- see changes detected in real-time or on save
- review proposals in UI
- see accepted truth projected back to Markdown

The system:
- captures suggested edits as **proposals**
- reviewers accept/reject proposals (no direct edits to accepted truth)
- applies accepted proposals into truth
- projects accepted truth back to Markdown deterministically (rewriting only ctx blocks it owns)

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

Agents should not treat Markdown as canonical truth.

They consume:
- accepted truth from context store (via `ContextStore` interface - file-based or MongoDB)
- open proposals
- unresolved questions
- decision and rejection history
- **Chain-of-thought reasoning**: Traverse reasoning chains (goal → decision → task → risk) to build context progressively

Agents can:
- query context store with comprehensive API (type, status, keyword, relationships)
- traverse graph relationships and reasoning chains
- propose changes (never mutate truth directly)
- open comment threads
- generate plans or tasks

Agents **cannot mutate truth directly** - all changes go through proposal/review workflow.

**Comprehensive Query API**: 
- Query by type, status, keyword, relationships
- Graph traversal and path finding
- Chain-of-thought traversal for progressive reasoning
- See [`docs/AGENT_API.md`](docs/AGENT_API.md) for full API documentation

This eliminates hallucinated state and context drift.

---

## Why This Matters

This enables things that are currently fragile or impossible:

- Architectural decisions that don't rot
- README files that reflect reality
- Agents that understand what is decided vs under discussion
- Automatic task and plan generation from unresolved context
- Auditable reasoning: *why* something exists, not just that it does
- **🔒 Secure agentic development**: Use AI agents without risking IP leakage
  - Agents query your context store (in your Git repo)
  - No sensitive context sent to external AI services
  - Complete control over what agents can access
  - Chain-of-thought reasoning happens locally

This is a foundation for **trustworthy, privacy-preserving agentic development**.

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

- **Security-conscious teams** who need agentic development without IP leakage
- Engineers tired of design decisions disappearing
- Teams building agentic systems that must keep context private
- Platform and infra teams that care about auditability and privacy
- Organizations with sensitive IP that can't use external AI services
- Open-source projects with long decision histories
- Anyone who has said:

> "The README lies, the PR is merged, and nobody remembers why."

> "We can't use AI tools because they'll leak our IP."

---

## Direction

- Correctness over flash
- Deterministic behavior over clever heuristics
- Review semantics before realtime polish
- Agent safety before convenience

A VS Code/Cursor extension is a natural client, but the core model does not depend on a specific UI.

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

**Note**: In this repository, the Markdown files with `ctx` blocks are committed for demonstration/self-reference. In other deployments, you may keep Markdown client-side or in a repo — either way it’s a projection, and truth changes only via accepted proposals.

These files use `ctx` blocks to embed semantic nodes. The system imports edits as proposals, manages review, and exports accepted truth back to Markdown.

This demonstrates the approach in practice - if we can't use our own tool effectively, we shouldn't expect others to.

See [`docs/SELF-REFERENCE.md`](docs/SELF-REFERENCE.md) for details on how this works.

## Getting Started

### Prerequisites

**Node.js and npm are required** (Node.js 18+ recommended). npm comes bundled with Node.js.

- **Don't have Node.js?** See [`INSTALL_NODEJS.md`](INSTALL_NODEJS.md) for installation instructions.

### Quick Install (Recommended)

Once Node.js is installed, use the installation script to automatically set up everything:

```bash
# Cross-platform (Node.js script - recommended)
node scripts/install.js

# Or via npm
npm run install:all

# Windows PowerShell
.\scripts\install.ps1

# macOS/Linux
chmod +x scripts/install.sh
./scripts/install.sh
```

The install script will:
- Check Node.js and npm versions
- Install all dependencies
- Verify installation
- Build the project
- Run tests

See [`scripts/README.md`](scripts/README.md) for more options and troubleshooting.

### Manual Install

If you prefer to install manually:

```bash
npm install
npm run build
npm test
```

## Playground (Scenario Runner)

If you want to see the system working end-to-end (scenarios + guided flows) via a tiny local web UI, use the playground.

- Source: [`src/playground/`](src/playground/)
- Run: `npm run playground`
- Open: `http://localhost:4317`

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

## Whitepaper (Target-State Overview)

See [`docs/WHITEPAPER.md`](docs/WHITEPAPER.md) for a comprehensive target-state whitepaper that highlights the solution’s distinguishing elements vs hodgepodge and common alternatives.

Key architectural points:
- **Graph Model**: Nodes with typed relationships (see [`DECISIONS.md`](DECISIONS.md) decision-015)
- **Dual Storage (planned)**: File-based (intended default) and MongoDB (production) via `ContextStore` abstraction (see [`DECISIONS.md`](DECISIONS.md) decision-005)
- **Review mode**: proposals are the only write primitive (see [`docs/REVIEW_MODE.md`](docs/REVIEW_MODE.md))
- **Change capture**: proposals can be authored directly or derived from Markdown ctx blocks (see [`docs/CHANGE_DETECTION.md`](docs/CHANGE_DETECTION.md))
- **Agent API**: Comprehensive query API with chain-of-thought traversal (see [`docs/AGENT_API.md`](docs/AGENT_API.md))
- **Security**: All data self-hosted (Git or MongoDB), no external services (see [`CONTEXT.md`](CONTEXT.md) constraint-005)

## Implementation Status

**Current**: Phase 1 - Core Infrastructure ✅
- Type system, in-memory store, Markdown projection

**Next**: Phase 2 - Persistence & Storage Implementations
- Storage abstraction layer
- File-based storage (intended default)
- MongoDB storage (production)
- GraphQL API layer

**See**: [`docs/STORAGE_IMPLEMENTATION_PLAN.md`](docs/STORAGE_IMPLEMENTATION_PLAN.md) for comprehensive gap analysis, implementation tasks, and timeline (10 phases, ~25-35 weeks estimated)

## Examples

See the [`examples/`](examples/) directory for non-self-referential examples of using the system.

## License

MIT
