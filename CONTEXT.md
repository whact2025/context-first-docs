# Project Context

This document contains the core context and background for the TruthLayer project itself (an Agentic Collaboration Approval Layer — ACAL).

```ctx
type: context
id: context-001
status: accepted
---
This project addresses the problem of context collapse in modern knowledge work (including software development).
Decisions, rationale, and constraints often live in ephemeral channels like Slack or
get lost in PR comments. This system provides a durable, reviewable, agent-safe way
to maintain project context.

The project itself uses the same review-mode workflow to document itself — this file and others are
managed through the ACAL workflow (proposals → review → apply), demonstrating the approach in practice.
```

```ctx
type: goal
id: goal-001
status: accepted
---
Create an agentic collaboration approval layer (ACAL) that enables:
- Durable decision tracking
- Agent-safe context consumption
- Human-readable Markdown interface
- Git-friendly workflows
- Self-documenting projects (like this one)
- In-editor review and context awareness via VS Code/Cursor extension
- Pre-baked Cursor rules for AI-assisted proposal and risk authoring
- Designated contributors and approvers with role-based access control
- Automatic issue creation on proposal approval
- Role-based Markdown editing (read-only vs editable)
- Bidirectional sync - Markdown edits sync back to context store and referencing nodes
- Hybrid reconciliation for concurrent edits - conflict detection, field-level merging, optimistic locking, manual resolution
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
