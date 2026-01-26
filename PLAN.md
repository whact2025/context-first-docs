# Development Plan

This document tracks the development roadmap and milestones for context-first-docs.

```ctx
type: plan
id: plan-001
status: accepted
---
**Phase 1: Core Infrastructure** (Current)
1. Define node types and proposal system ✅
2. Implement context store interface ✅
3. Build Markdown projection system (ctx blocks) ✅
4. Create import/export functionality ✅
5. Implement in-memory store ✅
6. Make project self-referential ✅

**Phase 2: Review System** (Next)
1. Implement proposal review workflow
2. Add comment threading
3. Support partial accept/reject
4. Build review history tracking

**Phase 3: Persistence**
1. File-based store implementation (JSON/YAML)
2. Git-backed store for versioning
3. Migration tools for existing docs

**Phase 4: Agent APIs**
1. Design agent-safe query API
2. Implement proposal generation API
3. Add validation and safety checks
4. Create agent documentation

**Phase 5: Integration**
1. GitHub/GitLab integration
2. VS Code extension (optional)
3. CLI tools
4. CI/CD integration
```

```ctx
type: task
id: task-001
status: completed
---
Implement core node type system with TypeScript interfaces.
```

```ctx
type: task
id: task-002
status: completed
---
Create proposal system for tracked changes.
```

```ctx
type: task
id: task-003
status: completed
---
Implement ctx block parser for Markdown.
```

```ctx
type: task
id: task-004
status: completed
---
Build in-memory context store implementation.
```

```ctx
type: task
id: task-005
status: completed
---
Make project self-referential - use own system to document itself.
```

```ctx
type: task
id: task-006
status: in-progress
---
Create file-based persistence layer for context store.
```

```ctx
type: task
id: task-007
status: open
---
Implement proposal review workflow with accept/reject.
```

```ctx
type: task
id: task-008
status: open
---
Add comment threading to proposals.
```

```ctx
type: task
id: task-009
status: open
---
Create CLI tool for importing/exporting context.
```

```ctx
type: task
id: task-010
status: open
---
Write comprehensive tests for all core functionality.
```
