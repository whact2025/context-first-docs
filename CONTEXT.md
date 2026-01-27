# Project Context

This document contains the core context and background for the context-first-docs project itself.

```ctx
type: context
id: context-001
status: accepted
---
This project addresses the problem of context collapse in modern software development.
Decisions, rationale, and constraints often live in ephemeral channels like Slack or
get lost in PR comments. This system provides a durable, reviewable, agent-safe way
to maintain project context.

The project itself uses this system to document itself - this file and others are
managed through the context-first system, demonstrating the approach in practice.
```

```ctx
type: goal
id: goal-001
status: accepted
---
Create a context-first collaboration system that enables:
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
This project should be self-referential - it uses its own context-first system
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
through the context-first system, demonstrating the approach in practice.
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
- All data stored in Git repository (no external cloud services)
- No external APIs or services required for core functionality
- Can use self-hosted Git (GitLab, Gitea, etc.)
- Optional graph databases must be file-based and self-hosted
- No context data sent to external services
- Full control over data location and access
- Supports air-gapped deployments

**Storage Options**:
- Primary: JSON files in Git (fully git-friendly, reviewable)
- Optional: Text-based graph formats (GraphML, DOT, GEXF, JSON Graph) in Git
- Optional: Embedded file-based databases (Kuzu, SQLite) - files in Git, no external service

**Security Benefits**:
- All data in Git repository (versioned, auditable)
- Can use self-hosted Git infrastructure
- No external dependencies for core functionality
- Full organizational control over data
```

```ctx
type: note
id: note-001
status: accepted
---
**Note on Self-Reference**: 

This project is self-referential - it uses its own context-first system to document
itself. The Markdown files in the project root contain ctx blocks that embed semantic
nodes. As the system matures, these will be automatically synchronized with the
canonical context store in `.context/`.

Currently (early development), the files are manually maintained but structured to
work with the system. Once file-based persistence and import/export are implemented,
the full workflow will be automated.

See `docs/SELF-REFERENCE.md` for more details.
```
