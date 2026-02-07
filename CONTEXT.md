# Project Context

This document contains the core context and background for the TruthLayer project itself. **Canonical product and architecture docs live in [docs/](docs/README.md).**

```ctx
type: context
id: context-001
status: accepted
---
This project addresses truth fragmentation in organizations: decisions, rationale, and constraints live in ephemeral channels or get lost; agents ingest stale or contradictory context.

TruthLayer is **Ratify truth. AI with Guardrails for Security & Compliance**: enterprise truth governance for humans and agents via a **truth ledger + collaboration layer**. Humans **ratify** (review and apply); **guardrails** (ACAL, RBAC, audit) keep AI safe and compliant. It enforces ACAL (Accepted → Candidate → Accepted → Ledger): accepted truth is immutable; all changes are proposals; proposals are reviewed (accept/reject with comments); accepted proposals are applied, producing new accepted revisions. Agents can read accepted truth and author proposals; they cannot accept, reject, or apply. One minimal governance UI is required; the Agent and rich UIs (Web, VS Code, Word/Google) are optional.

The project itself uses the same workflow to document itself — this file and others are managed through proposals → review → apply.
```

```ctx
type: goal
id: goal-001
status: accepted
---
Build **TruthLayer** as defined in docs/ (truth ledger + collaboration layer, ACAL):
- **Truth Store** — Canonical graph (nodes + edges), accepted revisions ledger, proposals/reviews/apply artifacts.
- **Policy & Governance** — RBAC, approval rules, validation, audit logging.
- **Projection Engine** — Markdown/DOCX/HTML; change detection turns edits into proposal operations.
- **Minimal Governance UI (required)** — List proposals, accept/reject/apply; see docs/core/UI_SPEC.md.
- **The Agent** (we build it) — Agent that uses the API to query truth and propose changes; never review/apply; see docs/core/AGENT_API.md, docs/appendix/CONTEXTUALIZED_AI_MODEL.md.
- Optional clients: VS Code extension, full Web UI, Word/Google (docs/appendix/OPTIONAL_INTEGRATIONS.md, docs/appendix/DOCX_REVIEW_INTEGRATION.md).
- Designated contributors and approvers, conflict detection and reconciliation, issue creation on approval.
- Context relationship visualization where applicable (docs/appendix/DOCX_REVIEW_INTEGRATION.md).
```

```ctx
type: goal
id: goal-002
status: accepted
---
This project should be self-referential - it uses its own ACAL semantics
to document itself. This demonstrates the approach and serves as a living example.
```

```ctx
type: constraint
id: constraint-001
status: accepted
---
The system must be deterministic - same context state must always produce
the same Markdown output. This is critical for Git workflows and agent safety.
```

```ctx
type: constraint
id: constraint-002
status: accepted
---
The system must preserve rejected ideas for provenance. We need to know not just
what was decided, but what alternatives were considered and why they were rejected.
```

```ctx
type: constraint
id: constraint-003
status: accepted
---
The project must use its own system to document itself. This is a core principle -
if we can't use our own tool effectively, we shouldn't expect others to.

This file and others (DECISIONS.md, PLAN.md, RISKS.md, QUESTIONS.md) are managed
through the ACAL workflow (proposals → review → apply), demonstrating the approach in practice.
```

```ctx
type: constraint
id: constraint-004
status: accepted
---
The system must install cleanly into any existing git repository without polluting it.

**Requirements**:
- No forced changes to existing files
- Minimal new files (only `.context/` directory)
- All features are opt-in
- Existing Markdown files work unchanged (ctx blocks are optional)
- No breaking changes to existing git workflows
- Clean .gitignore entries (only ignore `.context/` directory)
- Backward compatible - repositories without the system continue to work normally

**Installation should be**:
- Non-invasive: Add `.context/` directory, optionally add context files
- Reversible: Can be removed without breaking the repository
- Incremental: Can adopt gradually, file by file
- Optional: Existing docs continue to work without ctx blocks
- Migration-friendly: Can reverse engineer existing merge requests/PRs to extract context
```

```ctx
type: constraint
id: constraint-005
status: accepted
---
The system must keep all context data within the organization with no data leak to external services.

**Requirements**:
- All infrastructure self-hosted within organization (no external cloud services)
- No external APIs or services required for core functionality
- Can use self-hosted Git (GitLab, Gitea, etc.) for backup/archive
- Can use self-hosted databases (MongoDB, CouchDB, ArangoDB) for primary storage
- No context data sent to external services
- Full control over data location and access
- Supports air-gapped deployments

**Storage Options**:
- **Primary Storage**: Self-hosted document database (MongoDB, CouchDB, ArangoDB) - recommended for production
  - Provides ACID transactions, concurrency control, scalability
  - GraphQL API layer for type-safe queries
  - All infrastructure self-hosted within organization
- **Backup/Archive**: Git repository (self-hosted GitLab, Gitea, etc.)
  - Periodic snapshots for version history and disaster recovery
  - Reviewable changes for compliance/audit
  - Not primary storage - database is source of truth
- **Alternative (Simple)**: File-based storage (JSON Graph in Git) - acceptable for small deployments
  - Fully git-friendly, reviewable
  - Simpler architecture but limited scalability/concurrency

**Security Benefits**:
- All data and infrastructure within organization (self-hosted)
- No external dependencies for core functionality
- Full organizational control over data
- Zero IP leakage - all context stays within organization
- Air-gapped deployment support

**Note**: See `docs/STORAGE_ARCHITECTURE.md` for detailed comparison of file-based vs GraphQL + document DB approaches.
```

```ctx
type: note
id: note-001
status: accepted
---
**Note on Self-Reference**: 

This project is self-referential - it uses its own ACAL semantics to document
itself. The Markdown files in the project root contain ctx blocks that embed semantic
nodes. As the system matures, these will be automatically synchronized with the
canonical context store in `.context/`.

Currently, the files are committed for demonstration/self-reference. The repo already includes
Markdown import/projection utilities and a review-mode store for demos/tests; persistent
file-based storage is still planned, at which point synchronization can be automated end-to-end.

See `docs/SELF-REFERENCE.md` for more details.
```
