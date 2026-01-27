# Context-First Docs for Agentic Development

## TL;DR
This project is **not a document editor**.

It looks like Markdown.  
It feels like Google Docs review mode.  
It behaves like a structured, auditable **context graph** that **humans and AI agents can safely reason over**.

**🔒 Project context and IP never leak outside your organization** - all data stays in your Git repository, self-hosted, with complete organizational control.

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
- **Graph format storage**: JSON Graph format - centrally managed (NOT in Git) - default storage for all collected data
- **UI-only Markdown**: ctx blocks and rendered Markdown exist only in UI (VS Code/Cursor extension, web UI), NOT in Git
- **Real-time change detection**: Embedded in UI layer - detects changes as you type or on save
- **Docs-style comments and tracked changes**: Accept/reject proposals with review semantics
- **Structured semantic nodes**: Goals, decisions, constraints, tasks, risks, questions with typed relationships
- **Bidirectional synchronization**: Markdown ↔ context store (UI-based, not Git-based)
- **First-class agent APIs**: Comprehensive query API with chain-of-thought traversal for reasoning through contexts
- **VS Code/Cursor extension**: Required for v1 - in-editor review, context awareness, real-time change detection
- **Pre-baked Cursor rules**: AI-assisted proposal and risk authoring
- **Reverse engineering**: Extract historical context from merge requests/PRs
- **Role-based access control**: Designated contributors and approvers with permissions
- **Automatic issue creation**: Issues created when proposals are approved
- **Hybrid conflict reconciliation**: Automatic detection, field-level merging, optimistic locking, manual resolution
- **🔒 Zero IP Leakage**: All project context and IP stays within your organization
  - All data stored in central context store (self-hosted within organization)
  - **NOT in Git**: Contexts are NOT subject to git commits/merges - centrally managed
  - No external cloud services required
  - No data sent to external APIs
  - Complete organizational control over data location and access
  - Supports air-gapped deployments

This is infrastructure for **long-lived, multi-human, multi-agent systems** where **privacy and IP protection are critical**.

---

## Core Idea

### Canonical Context Store
The system stores **meaning**, not blobs of text.

- Every concept is a typed node with identity and status
- **Graph model**: Nodes form a graph with typed relationships (parent-child, depends-on, references, implements, blocks, etc.)
- **Graph format storage**: JSON Graph format - centrally managed (NOT in Git) - the source of truth
- Changes are represented as **proposals**, not diffs
- Accepting or rejecting a change is a **first-class decision**
- Rejected ideas are preserved for provenance
- **🔒 All data in central context store**: Self-hosted within organization, **zero IP leakage**
  - Centrally managed for organization/project (NOT in Git)
  - **No git commits/merges**: Contexts are NOT subject to git operations
  - All context stays within your organization
  - No cloud services, no external APIs
  - Complete control over data location and access
  - Air-gapped deployments supported

This is equivalent to Word / Docs tracked changes — but **explicit, structured, queryable, graph-native, and privacy-preserving**.

---

### README-Style Markdown as a UI Projection
Humans interact through familiar Markdown files **in the UI** (VS Code/Cursor extension, web UI):

- `README.md`
- `CONTEXT.md`
- `DECISIONS.md`
- `PLAN.md`
- `RISKS.md`

**Important**: 
- These Markdown files with ctx blocks are **UI-only** and **NOT committed to Git**
- Context store is **centrally managed** and **NOT in Git** - contexts are NOT subject to git commits/merges

Semantic sections are wrapped in lightweight `ctx` blocks with stable IDs.

Humans can:
- edit Markdown files in UI (VS Code/Cursor extension, web UI)
- see changes detected in real-time or on save
- review proposals in UI
- see accepted truth projected back to Markdown

The system (embedded in UI):
- detects changes to ctx blocks **in real-time** (as you type or on save)
- imports edits as **proposals** immediately
- stores proposals in central context store (NOT in Git)
- exports accepted truth back to Markdown **deterministically** in UI
- rewrites only the sections it owns

**Change detection is embedded in the UI** - not through Git operations. **Context store is centrally managed** - contexts are NOT subject to git commits/merges. This enables real-time collaboration without Git conflicts.

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

Agents **never read raw Markdown** (which is UI-only anyway).

They consume:
- accepted truth from context store (graph format)
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

**Note**: These Markdown files with ctx blocks are committed to Git for this self-referential project, but in normal usage, Markdown files would be UI-only. The context store is centrally managed (NOT in Git) - contexts are NOT subject to git commits/merges.

These files use `ctx` blocks to embed semantic nodes. The system imports edits as proposals, manages review, and exports accepted truth back to Markdown.

This demonstrates the approach in practice - if we can't use our own tool effectively, we shouldn't expect others to.

See [`docs/SELF-REFERENCE.md`](docs/SELF-REFERENCE.md) for details on how this works.

## Getting Started

```bash
npm install
npm run build
npm test
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

Key architectural points:
- **Graph Model**: Nodes with typed relationships (see [`DECISIONS.md`](DECISIONS.md) decision-015)
- **Graph Format Storage**: JSON Graph format as default storage (see [`DECISIONS.md`](DECISIONS.md) decision-005)
- **UI-Only Markdown**: ctx blocks and Markdown are UI-only, not committed to Git (see [`DECISIONS.md`](DECISIONS.md) decision-016)
- **Change Detection**: Embedded in UI layer (see [`docs/CHANGE_DETECTION.md`](docs/CHANGE_DETECTION.md))
- **Agent API**: Comprehensive query API with chain-of-thought traversal (see [`docs/AGENT_API.md`](docs/AGENT_API.md))
- **Security**: All data in Git, self-hosted, no external services (see [`CONTEXT.md`](CONTEXT.md) constraint-005)

## Examples

See the [`examples/`](examples/) directory for non-self-referential examples of using the system.

## License

MIT
