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

**Phase 2: Authoring & Review System** (Next)
1. Implement proposal authoring APIs and helpers
2. Add risk authoring tools and validation
3. Create authoring helpers for all node types (decisions, tasks, questions, etc.)
4. Implement role and permission system (contributors, approvers, admins)
5. Add designated contributors and approvers support
6. Implement role-based Markdown editing modes (read-only vs editable)
7. Implement bidirectional sync - Markdown edits sync back to context store and referencing nodes
8. Implement proposal review workflow with approval requirements
9. Add issue creation on approval - automatically create issues when proposals are approved
10. Add comment threading
11. Support partial accept/reject
12. Build review history tracking
13. Support multi-approval workflows

**Phase 3: Persistence & Git Integration**
1. File-based store implementation (JSON/YAML) - independent persistence
2. Commit tracking system - link commits to proposals/nodes (Jira-style checkin semantics)
3. Git integration for commit message parsing and proposal linking
4. Migration tools for existing docs

**Phase 4: Agent APIs**
1. Design agent-safe query API
2. Implement proposal generation API
3. Add validation and safety checks
4. Create agent documentation

**Phase 5: Installation & Integration**
1. Clean installation system - non-invasive setup for existing repositories
2. Migration tools - convert existing docs to context-first format (optional)
3. VS Code/Cursor extension - in-editor review and context awareness (required)
4. GitHub/GitLab integration
5. CLI tools for installation and management
6. CI/CD integration
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

```ctx
type: task
id: task-011
status: open
---
Implement proposal authoring API - helper functions for creating proposals programmatically.
```

```ctx
type: task
id: task-012
status: open
---
Add risk authoring tools - validation, templates, and helpers for creating risk nodes.
```

```ctx
type: task
id: task-013
status: open
---
Create authoring helpers for all node types (decisions, tasks, questions, constraints, goals).
```

```ctx
type: task
id: task-014
status: open
---
Build CLI authoring commands for creating proposals and nodes interactively.
```

```ctx
type: task
id: task-015
status: open
---
Implement commit tracking - link git commits to proposals/nodes when proposals are implemented.
```

```ctx
type: task
id: task-016
status: open
---
Add checkin semantics - parse commit messages for proposal references and track commit hashes.
```

```ctx
type: task
id: task-017
status: open
---
Ensure context store persistence is independent of git commits - proposals persist immediately upon creation.
```

```ctx
type: task
id: task-018
status: open
---
Design clean installation process - minimal files, opt-in features, non-invasive setup.
```

```ctx
type: task
id: task-019
status: open
---
Create installation CLI - initialize `.context/` directory and optional setup files.
```

```ctx
type: task
id: task-020
status: open
---
Build migration tools - optionally convert existing Markdown docs to use ctx blocks.
```

```ctx
type: task
id: task-021
status: open
---
Ensure backward compatibility - repositories work normally without context-first system.
```

```ctx
type: task
id: task-022
status: open
---
Build VS Code/Cursor extension - in-editor review, proposal management, and context awareness.
```

```ctx
type: task
id: task-023
status: open
---
Implement extension features - ctx block highlighting, proposal creation, review UI, context queries.
```

```ctx
type: task
id: task-024
status: open
---
Create pre-baked Cursor rules for proposal authoring - guide AI to create proposals with proper structure and metadata.
```

```ctx
type: task
id: task-025
status: open
---
Create pre-baked Cursor rules for risk authoring - guide AI to create risks with severity, likelihood, and mitigation.
```

```ctx
type: task
id: task-026
status: open
---
Integrate Cursor rules into installation process - automatically install rules when initializing a repository.
```

```ctx
type: task
id: task-027
status: open
---
Build MR/PR reverse engineering - analyze existing merge requests and pull requests to extract proposals, decisions, and risks.
```

```ctx
type: task
id: task-028
status: open
---
Implement PR/MR comment analysis - extract decisions, rationale, and rejected alternatives from PR comments.
```

```ctx
type: task
id: task-029
status: open
---
Create migration from PR history - convert historical PRs/MRs into context nodes and proposals.
```

```ctx
type: task
id: task-030
status: open
---
Build GitHub/GitLab API integration - access PR/MR data, comments, and commit history for reverse engineering.
```

```ctx
type: task
id: task-031
status: open
---
Implement role and permission system - contributors, approvers, and admins with proper access control.
```

```ctx
type: task
id: task-032
status: open
---
Add designated contributors and approvers - configure who can create proposals and who can approve them.
```

```ctx
type: task
id: task-033
status: open
---
Implement approval requirements - support multi-approval workflows and required approvers per node type.
```

```ctx
type: task
id: task-034
status: open
---
Add role validation - check permissions before allowing proposal creation, review, and approval actions.
```

```ctx
type: task
id: task-035
status: open
---
Implement issue creation on approval - automatically create issues when proposals are approved.
```

```ctx
type: task
id: task-036
status: open
---
Build issue templates system - define reusable issue templates for different proposal types.
```

```ctx
type: task
id: task-037
status: open
---
Add issue configuration to proposals - allow proposals to specify what issues should be created on approval.
```

```ctx
type: task
id: task-038
status: open
---
Implement role-based Markdown editing modes - read-only for some roles, editable for others.
```

```ctx
type: task
id: task-039
status: open
---
Build bidirectional sync system - Markdown edits sync back to context store and update referencing nodes.
```

```ctx
type: task
id: task-040
status: open
---
Implement reference tracking - detect and update nodes that reference changed content.
```
