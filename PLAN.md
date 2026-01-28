# Development Plan

This document tracks the development roadmap and milestones for context-first-docs.

See `docs/UI_SPEC.md` for the clean-slate UI specification aligned to ACAL.

```ctx
type: plan
id: plan-001
status: accepted
---
**Phase 1: Core Infrastructure** (Current)
1. ✅ Define node types and proposal system
2. ✅ Implement context store interface
3. ✅ Build Markdown projection system (ctx blocks)
4. ✅ Create import/export functionality
5. ✅ Implement in-memory store
6. ✅ Make project self-referential
7. ✅ Define graph model with typed relationships
8. ✅ Design comprehensive Agent API with chain-of-thought traversal

**Phase 2: Persistence & Storage Implementations** (Next)
1. ✅ Complete InMemoryStore baseline + extract reusable store core logic (`src/store/core/*`) with coverage tests (see `docs/STORAGE_IMPLEMENTATION_PLAN.md` Phase 1)
2. Storage abstraction layer - storage factory, configuration system, backend selection (see Phase 2)
3. File-based storage implementation - JSON graph format (example path: `.context/graph.json`) (see Phase 3)
4. MongoDB storage implementation - self-hosted MongoDB document database (for production/scaling) (see Phase 4)
5. GraphQL API layer - schema definition, resolvers, type validation, authentication/authorization (see Phase 5)
6. Conflict detection and resolution - build on the baseline (conflict detection, field-level merge, optimistic locking) with manual resolution + superseding workflow (see Phase 6)
7. Chain-of-thought traversal - reasoning chains, context building, decision reasoning (see Phase 7)
8. Issue creation system - create issues from approved proposals (see Phase 8)
9. Reference tracking - bidirectional references, automatic updates (see Phase 9)
10. Git integration - automatic commits (file-based), snapshots (MongoDB), commit tracking (see Phase 10)

**See**: `docs/STORAGE_IMPLEMENTATION_PLAN.md` for detailed gap analysis, implementation tasks, and timeline

**Phase 3: Authoring & Review System**
1. Implement proposal authoring APIs and helpers
2. Add risk authoring tools and validation
3. Create authoring helpers for all node types (decisions, tasks, questions, etc.)
4. Implement role and permission system (contributors, approvers, admins)
5. Add designated contributors and approvers support
6. Implement role-based authoring modes (read-only vs suggesting)
7. Implement bidirectional sync - proposals (optionally derived from Markdown ctx blocks) ↔ projections
8. Implement client/API change-capture workflows (client-side diffs or API-side structured edits), while enforcing review-mode invariants in the store
9. Implement hybrid reconciliation system:
   - Conflict detection at proposal creation
   - Field-level merging for non-conflicting fields
   - Optimistic locking with version tracking
   - Manual resolution for true conflicts
   - Proposal superseding support
10. Implement proposal review workflow with approval requirements
11. Add issue creation on approval - automatically create issues when proposals are approved
12. Add **Docs-style comment threads** anchored to nodes/fields (not Markdown line numbers)
13. Support partial accept/reject
14. Build review history tracking
15. Support multi-approval workflows

**Phase 4: Agent APIs**
1. Implement comprehensive query API (type, status, keyword, relationships, pagination, sorting)
2. Implement chain-of-thought traversal APIs:
   - traverseReasoningChain() - follow logical relationship paths
   - buildContextChain() - progressive context building
   - followDecisionReasoning() - understand decision rationale
   - discoverRelatedReasoning() - find related context
   - queryWithReasoning() - query with automatic reasoning chains
3. Implement graph traversal APIs (relationship queries, path finding, dependencies)
4. Implement proposal generation API
5. Add validation and safety checks (default to accepted only, explicit opt-in for proposals)
6. Create agent documentation (see `docs/AGENT_API.md`)

**Phase 5: Installation & Integration**
1. Clean installation system - non-invasive setup for existing repositories
2. Self-hosted Git storage setup - configure storage service for self-hosted Git repository
3. Reverse engineering tools - extract historical context from existing merge requests/PRs
4. VS Code/Cursor extension (client) - in-editor review, context awareness, and proposal authoring/preview
5. Extension features:
   - Client-side change capture (on save or real-time) that produces proposals (review mode enforced by store)
   - Proposal creation and management UI
   - Context awareness while coding
   - Role-based authoring modes (read-only vs suggesting)
6. Pre-baked Cursor rules - AI-assisted proposal and risk authoring
7. GitHub/GitLab integration (for code repository, not context store)
8. Reverse engineering MRs/PRs - extract historical context from existing repositories
9. CLI tools for installation and management
10. CI/CD integration
11. Security/privacy validation - ensure zero IP leakage, all data in self-hosted Git
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
Implement file-based storage layer for context store (JSON graph format; example path: `.context/graph.json`).
```

```ctx
type: task
id: task-007
status: completed
---
Implement proposal review workflow with accept/reject.
```

```ctx
type: task
id: task-008
status: completed
---
Add Docs-style comment threading anchored to semantic nodes/fields (and optionally text ranges) for proposals and reviews.

Notes:
- Anchors should survive Markdown projection regeneration (anchor to `nodeId`/`field`, not file offsets).
- Include an optional quote/snippet to support best-effort re-anchoring when text changes.
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
status: in-progress
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
Implement commit tracking - link code git commits to proposals/nodes when proposals are implemented (Jira-style checkin semantics).
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
Ensure context store persistence is independent of git commits - proposals persist immediately in MongoDB upon creation. Git snapshots are periodic backups, not primary storage.
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
Build reverse engineering tools - extract historical context from existing merge requests/PRs to create initial context nodes.
```

```ctx
type: task
id: task-021
status: open
---
Ensure backward compatibility - repositories work normally without the ACAL layer enabled/installed.
```

```ctx
type: task
id: task-022
status: open
---
Build VS Code/Cursor extension (client) - in-editor review, proposal management, context awareness, and proposal authoring from editor changes (client-side capture; review mode enforced by store).
```

```ctx
type: task
id: task-023
status: open
---
Implement extension features - ctx block highlighting, proposal creation, review UI, context queries, real-time change detection (on save or as you type), role-based editing modes.
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
Create reverse engineering from PR history - extract historical context from PRs/MRs to create initial context nodes and proposals.
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

```ctx
type: task
id: task-041
status: completed
---
Build conflict detection system - detect when multiple proposals modify the same node.
```

```ctx
type: task
id: task-042
status: completed
---
Implement field-level merging - auto-merge non-conflicting fields, flag conflicts.
```

```ctx
type: task
id: task-043
status: open
---
Create conflict resolution UI - side-by-side comparison and manual resolution interface.
```

```ctx
type: task
id: task-044
status: open
---
Implement optimistic locking - track node versions and reject stale proposals.
```

```ctx
type: task
id: task-045
status: completed
---
Implement graph model with typed relationships - parent-child, depends-on, references, implements, blocks, mitigates, related-to.
```

```ctx
type: task
id: task-046
status: completed
---
Complete InMemoryStore implementation - fix return types, align conflict typing, ensure apply updates node metadata (modifiedAt/modifiedBy/version), and make traversal/stale detection behavior deterministic (tests passing).
```

```ctx
type: task
id: task-058
status: completed
---
Extract reusable store core logic from InMemoryStore into `src/store/core/*` (query, conflicts/stale/merge, apply-proposal, graph traversal, node keying) and add targeted coverage tests to lock behavior.
```

```ctx
type: task
id: task-047
status: open
---
Implement storage abstraction layer - storage factory, configuration system, storage backend selection (file-based, MongoDB, memory).
```

```ctx
type: task
id: task-048
status: open
---
Implement file-based storage - FileBasedStore class, JSON Graph file management, Git integration, file locking/concurrency.
```

```ctx
type: task
id: task-049
status: open
---
Implement MongoDB storage layer - MongoDBStore class, collections setup, indexes, ACID transactions, connection management.
```

```ctx
type: task
id: task-050
status: open
---
Design and implement GraphQL API layer - schema definition (.context/schema.graphql), resolvers, type validation, authentication/authorization (works with both storage backends).
```

```ctx
type: task
id: task-051
status: open
---
Implement conflict detection and resolution - conflict detection algorithm, field-level merging, optimistic locking, proposal superseding.
```

```ctx
type: task
id: task-052
status: completed
---
Implement chain-of-thought traversal - reasoning chain traversal, context chain building, decision reasoning following, semantic similarity.
```

```ctx
type: task
id: task-053
status: open
---
Implement issue creation system - create issues from approved proposals, issue templates, issue configuration, issue lifecycle.
```

```ctx
type: task
id: task-054
status: open
---
Implement reference tracking - bidirectional reference tracking, automatic reference updates, reference validation.
```

```ctx
type: task
id: task-055
status: open
---
Implement Git integration - automatic Git commits for file-based storage, Git snapshot system for MongoDB, commit tracking (Jira-style checkin semantics).
```

```ctx
type: task
id: task-059
status: completed
---
Implement chain-of-thought traversal APIs - traverseReasoningChain, buildContextChain, followDecisionReasoning, discoverRelatedReasoning, queryWithReasoning.
```

```ctx
type: task
id: task-060
status: completed
---
Ensure clean review-mode semantics: Markdown/ctx blocks are treated as a projection format (repo or client), and all concurrent edits are proposals accepted/rejected into truth (no direct edits).
```

```ctx
type: task
id: task-061
status: open
---
Implement explicit “applied” state for proposals (distinct from “accepted”) so UIs can reliably show Accepted vs Applied and prevent re-apply.

Notes:
- Add `appliedAt`/`appliedBy` (and optional `appliedRevision`) metadata.
- Expose via store/API so all clients behave consistently.
```

```ctx
type: task
id: task-062
status: open
---
Define and enforce a workspace/tenancy model for the UI (`/workspaces/:ws`), including data partitioning and policy boundaries.

Notes:
- Decide whether workspace maps to store instance, namespace partition, or explicit workspaceId on entities.
- Ensure no cross-workspace leakage in queries, proposals, reviews, comments, and projections.
```

```ctx
type: task
id: task-063
status: open
---
Introduce “projection runs” / truth snapshot identity so the UI can label projections as “Generated from Truth Snapshot: X” and diff between runs deterministically.
```

```ctx
type: task
id: task-064
status: open
---
Build Web UI MVP aligned to `docs/UI_SPEC.md`:
- Explore (accepted-only default)
- Node detail (read-only accepted + Propose change)
- Proposal composer (structured ops + rationale + prechecks)
- Review accept/reject + Apply
- Projections viewer (non-canonical, deterministic outputs)
```

```ctx
type: task
id: task-065
status: open
---
Create shared UI component library + client SDK to enforce ACAL invariants consistently across web and VS Code extension (accepted-only defaults, proposal-only writes, anchored comments, clear proposal state).
```

```ctx
type: task
id: task-056
status: open
---
Validate security/privacy - ensure zero IP leakage, all data in self-hosted storage (file-based Git or MongoDB) within organization, no external services.
```

```ctx
type: task
id: task-057
status: open
---
Create comprehensive test suite - unit tests for all storage implementations, integration tests, performance tests, >80% coverage.
```
