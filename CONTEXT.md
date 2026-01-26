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
