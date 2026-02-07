# Architecture Decisions

This document tracks key architectural decisions made during the TruthLayer project (an Agentic Collaboration Approval Layer — ACAL). For **review-mode semantics** (proposal → review → apply), see `docs/core/REVIEW_MODE.md`. For **canonical walkthroughs** (day-in-the-life flows with concrete JSON and outcomes), see [Hello World](docs/scenarios/HELLO_WORLD_SCENARIO.md) (accept/apply/Markdown) and [Conflict and Merge](docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md) (conflict detection, field-level merge, stale proposals). For the full design narrative and status, see `docs/WHITEPAPER.md`. For **when to use TruthLayer vs Office/Google Docs + Copilot/Gemini** (doc suite feature set: document-centric truth, consumption across suite and messaging, drafting discussions/emails), see whitepaper §2.4 and §6.9.

```ctx
type: decision
id: decision-001
status: accepted
---
**Decision**: Use Markdown as the human interface, not as the source of truth.

**Rationale**: 
- Markdown is familiar to developers and renders well on GitHub/GitLab
- Git workflows work naturally with Markdown files
- However, Markdown alone is not structured enough for agent consumption
- Solution: Markdown is a projection of the canonical context store

**Alternatives Considered**:
- YAML/JSON as the interface (too technical, poor readability)
- Custom format (requires new tooling, harder adoption)
- Database-only (loses Git integration)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-002
status: accepted
---
**Decision**: Use ctx blocks for semantic sections in Markdown.

**Rationale**:
- Lightweight syntax that doesn't break Markdown rendering
- Stable IDs survive rebases and merges
- Clear separation between system-managed and human-edited content
- Can be ignored by tools that don't understand context blocks

**Alternatives Considered**:
- HTML comments (not visible, harder to work with)
- Frontmatter (only works at file level, not section level)
- Custom Markdown extensions (requires parser modifications)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-003
status: accepted
---
**Decision**: The project itself must be self-referential and use its own system.

**Rationale**:
- Demonstrates the approach in practice
- Serves as a living example for users
- Validates that the system works for real-world use
- Forces us to "eat our own dog food"

**Alternatives Considered**:
- Separate example project (less authentic, harder to maintain)
- Traditional documentation (defeats the purpose)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-004
status: accepted
---
**Decision**: Use TypeScript for type safety and better developer experience.

**Rationale**:
- Strong typing helps prevent errors in the context graph
- Better IDE support and autocomplete
- Easier to maintain as the system grows
- Type definitions serve as documentation

**Alternatives Considered**:
- JavaScript (less type safety)
- Rust/Go (higher barrier to entry, overkill for v1)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-005
status: accepted
---
**Decision**: Support both file-based and MongoDB storage implementations through a storage abstraction layer (`ContextStore` interface). Users can start with file-based storage and scale up to MongoDB as needed.

**Rationale**:
- **Abstraction Layer**: `ContextStore` interface allows multiple storage implementations
- **File-Based Storage**: Simple, Git-friendly, perfect for small projects and development
- **MongoDB Storage**: Production-ready with ACID transactions, concurrency control, and scalability
- **Scalability Path**: Users can start simple and scale up without code changes
- **Graph model** (see `decision-015`) requires graph-native storage format
- **No data loss**: Storage must persist `title` + `description`; `content` is a deterministic derived plain-text index (may be stored or recomputed) and must not silently drift
- **Self-hosted**: Both implementations run within organization (no external cloud services)
- **Proposal-based workflow**: All changes go through proposals/review workflow
- All data stays within organization (see `constraint-005`)

**Storage Abstraction**:
```mermaid
graph TB
    subgraph "Application Layer"
        UI[UI Layer]
        API[GraphQL API]
        App[Application Code]
    end
    
    subgraph "Storage Abstraction"
        Interface[ContextStore Interface]
    end
    
    subgraph "Storage Implementations"
        FileStore[File-Based Store<br/>JSON Graph in Git]
        MongoStore[MongoDB Store<br/>Self-Hosted]
    end
    
    UI --> API
    API --> App
    App --> Interface
    Interface --> FileStore
    Interface --> MongoStore
    
    style Interface fill:#e1f5ff
    style FileStore fill:#fff4e1
    style MongoStore fill:#e8f5e9
```

**Workflow**: Changes flow: UI/Agent → Proposal → Review → Approval → Storage Update (via `ContextStore` interface)

**Storage Architecture**:
```mermaid
graph TB
    subgraph "UI Layer"
        UI[VS Code/Cursor Extension<br/>Web UI]
    end
    
    subgraph "API Layer"
        GraphQL[GraphQL Server<br/>Self-Hosted]
        Schema[Schema: .context/schema.graphql]
        GraphQL -.-> Schema
    end
    
    subgraph "Storage Abstraction"
        Interface[ContextStore Interface]
    end
    
    subgraph "File-Based Implementation"
        FileStore[File-Based Store]
        GraphJSON[graph.json (example path)]
        NodeFiles[.context/nodes/]
        FileStore --> GraphJSON
        FileStore --> NodeFiles
    end
    
    subgraph "MongoDB Implementation"
        MongoStore[MongoDB Store<br/>Self-Hosted]
        Collections[(Collections:<br/>nodes, proposals,<br/>reviews, relationships)]
        MongoStore --> Collections
    end
    
    subgraph "Git Repository"
        Git[Git Repository<br/>Backup/Archive]
        Snapshots[.context/snapshots/]
        Git --> Snapshots
    end
    
    UI -->|GraphQL API| GraphQL
    GraphQL --> Interface
    Interface --> FileStore
    Interface --> MongoStore
    FileStore -.->|Periodic| Git
    MongoStore -.->|Periodic| Git
    
    style Interface fill:#e1f5ff
    style FileStore fill:#fff4e1
    style MongoStore fill:#e8f5e9
```

**File-Based Storage** (Intended default for development/small projects):
- **Format**: JSON graph format (example path: `.context/graph.json`) and optional per-node files
- **Location**: `.context/` directory in Git repository
- **Benefits**:
  - ✅ Simple, no external dependencies
  - ✅ Fully Git-friendly, reviewable in PRs
  - ✅ Perfect for small projects and development
  - ✅ Easy to understand and debug
  - ✅ All data in Git (versioned, auditable)
- **Limitations**:
  - ⚠️ Concurrency issues with multiple simultaneous edits
  - ⚠️ Scalability concerns with large graphs (thousands of nodes)
  - ⚠️ No ACID transactions

**MongoDB Storage** (Recommended for Production/Large Projects):
- **Database**: Self-hosted MongoDB (within organization)
- **Collections**: `nodes`, `proposals`, `reviews`, `relationships`
- **Benefits**:
  - ✅ **ACID transactions**: Atomic proposal approvals, no partial updates
  - ✅ **Concurrency control**: Built-in optimistic locking, no file conflicts
  - ✅ **Scalability**: Indexed queries, horizontal scaling
  - ✅ **GraphQL integration**: Excellent support via Hasura, Apollo, or custom resolvers
  - ✅ **Self-hostable**: Docker, Kubernetes deployment within organization
  - ✅ **Document model**: Natural fit for graph nodes and relationships
  - ✅ **Query performance**: Indexed relationship queries, aggregation pipeline
  - ✅ **Air-gapped support**: Can deploy without internet
- **Git Integration**: Periodic snapshots to Git for backup, version history, audit trail

**Storage Selection**:
- **Development/Small Projects**: File-based storage (intended default)
- **Production/Large Projects**: MongoDB storage (recommended)
- **Scaling Path**: Switch from file-based to MongoDB via configuration change (same `ContextStore` interface)

**GraphQL Schema** (`.context/schema.graphql`):
- Type-safe API definition
- Self-documenting (introspection)
- Human-readable schema changes (reviewable in PRs)
- Validation contract
- Works with both storage implementations
- See `docs/STORAGE_ARCHITECTURE.md` for full schema design

**Important**: Both storage implementations use the same `ContextStore` interface, allowing seamless scaling from file-based to MongoDB. All infrastructure is self-hosted within organization.


**Implementation Strategy**:
1. Start with file-based storage (simple, Git-friendly)
2. Implement MongoDB storage (production-ready)
3. Both use same `ContextStore` interface (abstraction layer)
4. Users configure storage backend (file-based or MongoDB)
5. Easy to scale up from file-based to MongoDB

**Decided At**: 2026-01-26
**Updated At**: 2026-01-26 (support both file-based and MongoDB via abstraction layer)
```

```ctx
type: decision
id: decision-006
status: accepted
---
**Decision**: Context persistence is independent of git commits. Git commits only occur when proposals are accepted/implemented.

**Rationale**:
- Authored content (proposals, risks, questions) should persist immediately upon creation
- Authors can work and iterate without requiring git commits
- Git commits represent implementation/completion, not authorship
- Enables asynchronous workflows where context evolves independently of code changes
- Similar to Jira where issues exist independently and commits reference them

**Implementation**:
- Proposals are persisted by the selected storage backend when created (independent of code commits)
- Git commits (if used) are tracked and linked to proposals via check-in semantics (e.g., commit messages reference proposal IDs)
- Commit messages can reference proposals (e.g., "Implements proposal-123")
- System tracks which commits correspond to which proposals/nodes
- Markdown projections can be generated on demand; they are not the canonical store

**Alternatives Considered**:
- Requiring git commits for persistence (too restrictive, breaks async workflows)
- Git as the only persistence mechanism (loses independence, harder to query)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-016
status: accepted
---
**Decision**: Markdown (including `ctx` blocks) is a **projection format**, not canonical truth. It may be stored in a repo or kept client-side. All concurrent edits are captured as **proposals** and accepted/rejected into truth (review mode).

**Rationale**:
- Accepted truth must not be directly mutated; proposals provide a safe, reviewable write path
- Markdown is familiar for humans, but is not structured enough to be canonical truth
- Some teams want Markdown committed for visibility; others want it client-side to reduce noise/conflicts
- Change capture can be client-side (diffing Markdown) or API-side (structured edits); the store enforces review-mode invariants either way
- File-based persistence can be Git-friendly, but the storage path/format is an implementation choice (e.g. a `.context/` directory)

**Implementation**:
- **Review mode**: clients create proposals; reviewers accept/reject; accepted proposals are applied into truth
- **Markdown import (optional)**: `ctx` blocks can be imported into proposals; non-ctx content is preserved
- **Markdown projection (optional)**: accepted truth can be projected back to Markdown deterministically

**Benefits**:
- Consistent collaboration semantics (suggest → review → apply)
- Supports multiple clients (editor extension, web UI, CLI, agents)
- Allows Markdown in Git *or* client-side without changing the core model

**Alternatives Considered**:
- Treat Markdown as canonical truth (agents can’t reliably distinguish truth vs proposal intent)
- Direct edits to accepted nodes (unsafe under concurrency; loses review semantics)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-007
status: accepted
---
**Decision**: Installation into existing repositories must be clean and non-invasive.

**Rationale**:
- Developers should be able to adopt the system without disrupting existing workflows
- Existing repositories should continue to work normally without the system
- Installation should be opt-in and incremental
- Minimal footprint reduces adoption friction

**Requirements**:
- Only adds `.context/` directory (already in .gitignore)
- No forced changes to existing files
- Context files (CONTEXT.md, DECISIONS.md, etc.) are optional
- Existing Markdown files work unchanged - ctx blocks are additive
- Can be installed incrementally (file by file)
- Can be removed without breaking anything
- Installation CLI should be simple and reversible

**Installation Process**:
1. Run `npx truth-layer init` (or similar)
2. Creates `.context/` directory structure
3. Installs pre-baked Cursor rules to `.cursor/rules/` directory
4. Optionally creates template context files
5. Updates `.gitignore` if needed (only adds `.context/` entry)
6. No changes to existing files unless explicitly requested

**Alternatives Considered**:
- Requiring changes to existing files (too invasive, breaks adoption)
- Separate repository for context (loses integration, harder to maintain)
- Database/external service (loses git integration, adds dependencies)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-008
status: superseded
---
**Decision**: VS Code/Cursor extension is required, not optional, for v1.

**Superseded by decision-031 (agentic-first):** Under the agentic-first design, the **primary interface** is the in-process agent; **one minimal review/apply surface** is required; rich UIs (Web, VS Code, Word/Google) are **optional**. So for v1, the VS Code/Cursor extension is **optional**, not required. The rationale below still applies to the extension when it is built (in-editor review, context awareness, authoring workflow); it is no longer a v1 requirement.

**Original Rationale**:
- In-editor review is essential for the "Google Docs review mode" experience
- Context awareness in the IDE enables developers to see proposals, decisions, and risks while coding
- Seamless authoring workflow - create proposals and review without leaving the editor
- Enables real-time context queries and proposal creation from within the editor

**Required Features (when extension is built)**:
- ctx block syntax highlighting and validation
- In-editor proposal creation and editing
- Review UI for accepting/rejecting proposals
- Context queries (show related decisions, risks, tasks)
- Integration with git for commit tracking
- Visual indicators for proposal status and review state

**Decided At**: 2026-01-26
**Superseded At**: 2026-01-29 (decision-031, agentic-first)
```

```ctx
type: decision
id: decision-010
status: accepted
---
**Decision**: Integration must support reverse engineering merge requests/PRs in pre-existing repositories.

**Rationale**:
- Enables reverse engineering of historical context from existing projects
- Captures historical decisions and rationale from PR/MR comments
- Extracts proposals, decisions, and risks from existing code review discussions
- Preserves institutional knowledge that exists only in PR/MR history
- Makes adoption easier for mature projects with extensive PR history
- Allows teams to build context graph retroactively from existing discussions

**Capabilities**:
- Analyze PR/MR titles, descriptions, and commit messages for decision patterns
- Extract decisions and rationale from PR/MR comments and discussions
- Identify rejected alternatives from comment threads
- Convert PR/MR discussions into proposals with proper status (accepted/rejected)
- Link extracted context to commits and code changes
- Handle both merged and closed PRs/MRs
- Support GitHub and GitLab APIs

**Process**:
1. Connect to repository via GitHub/GitLab API
2. Analyze PR/MR history (titles, descriptions, comments, commits)
3. Extract semantic content (decisions, risks, proposals, rationale)
4. Create context nodes and proposals from extracted content
5. Link to commits and code changes
6. Import into context store

**Use Cases**:
- Migrating existing projects to TruthLayer (ACAL)
- Building context graph from historical PR/MR discussions
- Capturing decisions that were made in PR comments but never documented
- Extracting risks and concerns raised during code review
- Preserving rationale for architectural decisions

**Alternatives Considered**:
- Manual migration only (too time-consuming, loses historical context)
- Starting fresh without historical context (loses valuable institutional knowledge)
- External tools for PR analysis (adds dependencies, less integrated)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-011
status: accepted
---
**Decision**: The system must support designated contributors and approvers with role-based access control.

**Rationale**:
- Enables proper governance and quality control
- Prevents unauthorized changes to accepted context
- Supports organizational hierarchies and responsibilities
- Allows fine-grained control over who can create vs approve proposals
- Enables multi-approval workflows for critical decisions
- Integrates with GitLab/GitHub permission models

**Role Model**:
- **Contributors**: Can create proposals and nodes, but cannot approve
- **Approvers**: Can review and approve/reject proposals, can also create proposals
- **Admins**: Full access, can manage users and roles

**Capabilities**:
- Configure designated contributors per project/namespace
- Configure designated approvers per project/namespace
- Support per-node-type approvers (e.g., architecture decisions require senior engineers)
- Support multi-approval requirements (e.g., critical risks need 2 approvals)
- Track who approved proposals (for audit trail)
- Validate permissions before allowing actions
- Integrate with GitLab/GitHub user/group permissions

**Implementation**:
- Role configuration stored in `.context/roles.json` (or similar)
- User roles can be synced from GitLab/GitHub groups
- Permission checks before proposal creation, review, and approval
- Review records include reviewer role and approval status
- Proposal metadata tracks required and actual approvers

**Use Cases**:
- Architecture decisions require senior engineer approval
- Risk proposals need security team approval
- Contributors can propose changes but approvers must review
- Multi-approval for critical decisions (e.g., 2 senior engineers)
- Admin-only actions (managing users, changing roles)

**Alternatives Considered**:
- No access control (too permissive, allows unauthorized changes)
- Single approver model (too restrictive, doesn't scale)
- External permission system only (loses integration, harder to manage)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-012
status: accepted
---
**Decision**: Approval of proposals must trigger automatic creation of issues.

**Rationale**:
- Approved proposals represent decisions that need implementation
- Automatically creating issues ensures nothing falls through the cracks
- Links approval decisions to actionable work items
- Enables tracking of implementation progress
- Supports workflow automation and reduces manual work
- Makes it clear what needs to be done after approval
- "Issues" is familiar terminology (GitHub Issues, Jira Issues, etc.)

**Workflow**:
1. Proposal is reviewed and approved
2. System checks if proposal has issue configuration
3. Issues are automatically created based on templates or custom configuration
4. Issues can be created as task nodes in the context store
5. Issues are linked back to the proposal and approval

**Issue Types**:
- **Implementation tasks**: Work needed to implement the approved proposal
- **Follow-up items**: Related work or next steps
- **Review tasks**: Items that need review or verification
- **Custom issues**: Proposal-specific items

**Configuration**:
- Proposals can specify issue templates to use
- Issue templates define what issues to create based on proposal type/content
- Custom issues can be defined per proposal
- Issues can be created as task nodes in context store
- Issues can have assignees, due dates, dependencies, priorities

**Examples**:
- Approved decision proposal → Creates implementation issue
- Approved risk proposal → Creates mitigation issue
- Approved constraint proposal → Creates compliance verification issue
- Approved plan proposal → Creates issues for each plan step

**Integration**:
- Issues created as task nodes can be queried and tracked
- Issues link back to originating proposal
- Issues can reference related nodes (decisions, risks, etc.)
- Issues can be assigned to contributors
- Issues can have dependencies on other tasks
- Can integrate with external issue trackers (GitHub Issues, Jira, Linear)

**Alternatives Considered**:
- Manual issue creation (too much work, things get forgotten)
- No issue creation (loses connection between approval and implementation)
- External task management only (loses integration, harder to track)
- Using "actions" terminology (less familiar, "issues" is standard)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-013
status: accepted
---
**Decision**: Markdown files support both read-only and editable modes based on user role. All Markdown edits must sync back to context store and update referencing nodes.

**Rationale**:
- Different roles need different access levels
- Contributors need to edit Markdown files directly
- Approvers/reviewers may only need read access
- Ensures context store stays in sync with Markdown
- Changes must propagate to all nodes that reference edited content

**Role-Based Modes**:
- **Contributors**: Can edit Markdown files (ctx blocks and other content)
- **Approvers**: Can edit Markdown files (for review and changes)
- **Read-only users**: Can view but not edit (if such role exists)
- **Admins**: Full edit access

**Sync Requirements**:
- Markdown edits to ctx blocks → Import as proposals → Sync to context store
- Markdown edits to non-ctx content → Track changes → Update referencing nodes
- Context store changes → Export to Markdown → Update all affected files
- Referencing nodes must be updated when referenced content changes
- Sync must be bidirectional and consistent

**Referencing Context**:
- When a node references another node (via relations), changes to referenced node must update referencer
- When Markdown content is referenced by multiple nodes, all must be updated
- Cross-references between files must be maintained
- Reference integrity must be preserved during sync

**Workflow**:
1. User edits Markdown file (based on role permissions)
2. System detects changes (ctx blocks and other content)
3. Changes imported as proposals (for ctx blocks)
4. Non-ctx content changes tracked and synced
5. Referencing nodes updated if referenced content changed
6. Context store updated with accepted changes
7. All affected Markdown files regenerated

**Alternatives Considered**:
- Read-only only (too restrictive, breaks familiar workflows)
- Editable only (loses control, harder to prevent drift)
- No sync back (loses bidirectional consistency)
- Manual sync only (too much work, error-prone)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-014
status: accepted
---
**Decision**: Use hybrid reconciliation approach for handling concurrent edits to the same ctx block.

**Rationale**:
- No single strategy fits all use cases
- Need balance between automation and control
- Must prevent data loss while allowing parallel work
- Field-level conflicts are often resolvable automatically
- True conflicts require human judgment

**Hybrid Strategy Components**:

1. **Conflict Detection** (Proposal-Based):
   - Detect conflicts at proposal creation time
   - Check if other open proposals modify the same nodes
   - Mark proposals as "conflicting" if conflicts detected
   - Track conflicting proposal relationships

2. **Field-Level Merging**:
   - Auto-merge non-conflicting fields automatically
   - Detect field-level conflicts (same field changed differently)
   - Preserve all non-conflicting changes
   - Flag conflicting fields for manual resolution

3. **Optimistic Locking**:
   - Track node version numbers (increment on each change)
   - Proposals reference base version they're modifying
   - Reject proposals if node version changed (stale)
   - Require proposal update to latest version before approval

4. **Manual Resolution**:
   - True conflicts require human review
   - Reviewers see all conflicting proposals side-by-side
   - Reviewer creates merged proposal or chooses one
   - System applies reviewer's resolution

5. **Proposal Superseding**:
   - Allow proposals to explicitly supersede others
   - Track proposal relationships and chains
   - When superseding proposal approved, mark superseded as superseded
   - Preserve full proposal history

**Workflow**:
1. User creates proposal → System checks for conflicts with open proposals
2. System records base versions of nodes being modified
3. If no conflicts → Normal review workflow
4. If field-level conflicts → Auto-merge non-conflicting fields, flag conflicts
5. If true conflicts → Mark proposal as "hasConflicts", require resolution
6. When applying proposal → Check node versions match base versions
7. If versions changed → Reject as stale, require update
8. Reviewer resolves conflicts → Creates merged proposal or chooses one
9. System applies resolution with version validation

**Configuration**:
- Per-node-type conflict strategies (can override default)
- Per-namespace conflict strategies
- Global default strategy
- Configurable auto-merge behavior

**Examples** (see `docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md` for full day-in-the-life walkthrough and playground scenarios `conflicts-and-merge`, `stale-proposal`):
- Proposal A changes `content` field, Proposal B changes `status` → Auto-merge (no conflict)
- Proposal A changes `content` to "X", Proposal B changes `content` to "Y" → Conflict, manual resolution
- Proposal created when node version is 5, but node is now version 7 → Reject as stale

**Implementation**: `src/store/core/conflicts.ts` — `detectConflictsForProposal`, `mergeProposals`, `isProposalStale`; `docs/appendix/RECONCILIATION_STRATEGIES.md`.

**Alternatives Considered**:
- Single strategy only (too rigid, doesn't fit all cases)
- No conflict detection (allows data corruption)
- Always manual resolution (too slow, blocks workflow)
- Always auto-merge (risky, may lose important changes)
- Lock-based only (blocks parallel work unnecessarily)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-015
status: accepted
---
**Decision**: Use a graph model with typed relationships instead of strict hierarchical nesting.

**Rationale**:
- More flexible than rigid parent-child hierarchies
- Can represent multiple relationship types (hierarchical, dependencies, references, etc.)
- Enables powerful graph queries and traversal
- Supports complex multi-dimensional relationships
- Can evolve relationship types without schema changes
- Better for AI agents to understand context and relationships
- Hierarchical views can be projected from graph when needed

**Graph Model Structure**:
- **Nodes**: Vertices in the graph (goals, decisions, tasks, etc.)
- **Edges**: Typed relationships between nodes
- **Edge Types**: Support multiple relationship types:
  - `parent-child`: Hierarchical relationships (sub-decisions, subtasks)
  - `depends-on`: Dependencies (task dependencies, decision dependencies)
  - `references`: References (decisions referencing goals, tasks referencing decisions)
  - `supersedes`: Replacement relationships (new decision supersedes old)
  - `related-to`: General relationships
  - `implements`: Implementation relationships (task implements decision)
  - `blocks`: Blocking relationships (risk blocks task)
  - `mitigates`: Mitigation relationships (task mitigates risk)

**Implementation Approach**:
- Replace simple `relations?: NodeId[]` with typed edge structure
- Store edges as separate entities or embedded in nodes (both approaches viable)
- Support graph queries: "find all descendants", "find all dependencies", "find path between nodes"
- Provide hierarchical projection APIs for UI/display purposes
- Maintain reverse index (`referencedBy`) for efficient traversal

**Benefits Over Strict Nesting**:
- No rigid parent-child constraints
- Can represent complex relationships (e.g., task depends on decision AND references goal)
- Enables relationship analysis and traversal
- Supports both hierarchical and non-hierarchical structures
- Extensible - can add new relationship types without breaking changes

**Alternatives Considered**:
- Strict hierarchical nesting (too rigid, limits flexibility)
- Simple untyped relations array (loses semantic meaning, harder to query)
- Separate relationship tables (more complex, but could be considered for very large graphs)
- Property graph with edge properties (more powerful but more complex, may be overkill)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-017
status: accepted
---
**Decision**: Extract provider-agnostic store logic into `src/store/core/*` and treat it as the canonical implementation for proposal application, querying/traversal, and conflict/stale/merge behavior.

**Rationale**:
- Avoid duplicating complex business logic across storage providers (in-memory, file-based, MongoDB).
- Ensure deterministic behavior and consistent semantics across backends.
- Improve testability: pure functions are easier to cover and reason about.
- Make future providers mostly responsible for I/O + indexing, not domain logic.

**Scope**:
- Node keying (`nodeKey`)
- Proposal application (`applyAcceptedProposalToNodeMap`)
- Querying/filtering/sorting/pagination + graph traversal (`queryNodesInMemory`, `graph` helpers)
- Conflict detection + stale checks + merge (`detectConflictsForProposal`, `isProposalStale`, `mergeProposals`)

**Decided At**: 2026-01-27
```

```ctx
type: decision
id: decision-018
status: accepted
---
**Decision**: Centralize runtime type guards and polymorphic cast/assert helpers in `src/utils/type-guards.ts`, and prefer explicit narrowing over broad type assertions.

**Rationale**:
- Reduce `as any` / `as unknown as` patterns that hide bugs.
- Make validation reusable across parsing (Markdown ctx blocks), store operations, and future API layers.
- Improve maintainability: shared guards prevent drift across modules.

**Decided At**: 2026-01-27
```

```ctx
type: decision
id: decision-019
status: accepted
---
**Decision**: Make ctx-block parsing strict for `type` and `status` by using the `NodeType` and `NodeStatus` unions; invalid values cause the block to be rejected (import returns `null` for that block).

**Rationale**:
- Prevent invalid node types/statuses from entering the system.
- Align the UI Markdown layer with the canonical type system.
- Fail closed so that downstream logic can rely on discriminated unions safely.

**Implementation Note**:
- The UI should surface validation feedback so “dropped blocks” don’t feel silent.

**Decided At**: 2026-01-27
```

```ctx
type: decision
id: decision-020
status: accepted
---
**Decision**: Reviewer comments and recommendations must be **anchored to semantic nodes** (Google Docs–style), not to Markdown line positions.

**Rationale**:
- Review feedback must remain stable even when Markdown projections are regenerated.
- Reviewers need to comment on *meaning* (a node/field) rather than a file diff.
- Agents should be able to query reviewer feedback directly (e.g., “open comments on `decision-123.description`”).
- Anchoring to node identity enables consistent workflows across clients (editor extension, web UI, CLI).

**Anchoring model**:
- Comments can attach to:
  - a **proposal** (general discussion), or
  - a **specific operation**, or
  - a **node anchor**: `{ nodeId, field, range? }`
- For long-form text fields (typically `description`), comments may include a **character range** anchor.
- Optionally store a short **quote/snippet** to help clients re-anchor if the text changes.

**Implementation (contract)**:
- Comments are persisted alongside proposals/reviews in the context store.
- The store exposes APIs to:
  - add/get proposal comments
  - query comments by proposal id and/or node anchor
- Clients render anchored comments as inline “suggestions/threads” on the relevant node fields (Docs-style).

**Notes**:
- Range re-anchoring across edits is a client/API concern; the store should preserve anchors and quotes and treat re-anchoring as best-effort.

**Decided At**: 2026-01-28
```

```ctx
type: decision
id: decision-021
status: accepted
---
**Decision**: “Accepted” and “Applied” are distinct states; the system must represent **applied** explicitly for proposal lifecycle correctness across clients.

**Rationale**:
- Review acceptance should not be conflated with truth mutation.
- UIs must be able to show “Accepted but not applied” and prevent accidental re-apply.
- Auditability requires recording who applied what, when.

**Implementation**:
- Add proposal metadata fields such as `appliedAt`, `appliedBy` (and optional `appliedRevision`).
- Applying should be idempotent from the UI perspective (no double-apply).

**Decided At**: 2026-01-28
```

```ctx
type: decision
id: decision-022
status: accepted
---
**Decision**: Introduce a first-class **workspace/tenancy boundary** for the UI and API, and enforce it consistently across nodes, proposals, reviews, comments, and projections.

**Rationale**:
- The UI route model (`/workspaces/:ws`) implies scoped navigation and policy boundaries.
- Multi-client operation must not leak data across organizational boundaries.

**Implementation Options**:
- Workspace maps to a store instance (recommended for simplicity), or
- workspace is enforced via namespace partitioning, or
- explicit `workspaceId` field is added to all persisted entities.

**Decided At**: 2026-01-28
```

```ctx
type: decision
id: decision-023
status: accepted
---
**Decision**: Projections must be attributable to a **truth snapshot**; introduce “projection runs” (or equivalent identity) so UIs can render and diff deterministic projection outputs.

**Rationale**:
- The UI must be able to say “Generated from Truth Snapshot: X” and compare runs.
- Determinism is part of the contract; a stable snapshot identifier makes that testable and auditable.

**Implementation**:
- Introduce a `ProjectionRun` concept (id, config, generatedAt/by, basedOnRevision/snapshot).
- Projection outputs remain non-canonical views derived from truth.

**Decided At**: 2026-01-28
```

```ctx
type: decision
id: decision-024
status: accepted
---
**Decision**: Node status in proposal operations is the **status that will be written on apply**; until apply, it is not part of accepted truth.

**Rationale**:
- Avoids ambiguity between "status in the operation" and "status in the store."
- Enables proposals to express post-apply intent (e.g. create with `status: "accepted"` so the node enters as accepted once applied).
- Documented in whitepaper §4.1 and Hello World / Conflict and Merge scenarios.

**Implementation**: No code change; semantic contract. See `docs/HELLO_WORLD_SCENARIO.md`, `docs/WHITEPAPER.md` §4.1.

**Decided At**: 2026-01-29
```

```ctx
type: decision
id: decision-025
status: accepted
---
**Decision**: The context store is the **substrate** for building a contextualized enterprise AI model (RAG, fine-tuning, structured prompting); it does not become the model. When using a **vendor LLM**, prompt leakage is controlled by a **policy interface**: sensitivity labels on nodes/namespaces, a retrieval policy module with allow/deny rules, and logging of node IDs included in prompts.

**Rationale**:
- Keeps enterprise IP and compliance concerns explicit: what may leave the perimeter is policy-driven.
- Store remains agnostic; policy layer wraps retrieval and prompt building (see `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` §3.4).
- Enables audit trail ("which node IDs were in this prompt") for compliance.

**Implementation**: Policy interface is **designed and documented**; retrieval policy module and sensitivity labels are **planned** (see PLAN Phase 4). Store today provides query/export/projection; policy enforcement is a thin layer on top.

**Decided At**: 2026-01-29
```

```ctx
type: decision
id: decision-026
status: accepted
---
**Decision**: Minimum secure deployment **today** is an **external wrapper**: API gateway (or BFF) that authenticates every request and gates `submitReview` and `applyProposal` on approver identity (e.g. JWT claim). Auth/roles inside the store or API layer are **roadmap**.

**Rationale**:
- Store does not enforce identity or roles yet; any client that can reach it can accept/apply.
- Enterprise readers need a concrete "how to run safely today": gateway + claim-based gating gives separation of duties (proposers vs approvers) at the perimeter.
- Operational posture (endpoints, audit logging today, approver-only apply in practice) is documented in whitepaper §7.4.

**Implementation**: Documented in `docs/WHITEPAPER.md` §7.4 (minimum secure deployment, operational posture today). No in-store auth yet.

**Decided At**: 2026-01-29
```

```ctx
type: decision
id: decision-027
status: accepted
---
**Decision**: TruthLayer is **complementary** to the **doc suite feature set** (Office/Google Docs + Copilot/Gemini). We do not replace document-centric truth or consumption across the full document suite and messaging apps (Teams, Chat, Slack, email), including using truth to draft discussions, emails, and similar artifacts.

**Rationale**:
- Office/Docs + Copilot/Gemini establish and consume truth well for **document-centric** workflows: policy, contracts, SOPs, strategy playbooks; consumption spans the entire suite and messaging; AI can draft discussions, emails, etc. from that truth (whitepaper §2.4, §6.9).
- TruthLayer targets **solution modeling** and **agent-safe structured truth**: typed graph (goals, decisions, risks, tasks), enforceable proposal/review/apply semantics, accepted-only reads by default, deterministic projection, provenance of rejected ideas, self-hosted contextualized AI with prompt-leakage policy.
- Many organizations use **both**: doc suite + AI for narrative/policy/messaging; TruthLayer for technical decisions, solution graph, and agent-heavy workflows where structured truth and agent-safe consumption matter.

**Implementation**: Positioning and use cases documented in `docs/WHITEPAPER.md` §2.4 (use cases where Office/Docs + Copilot/Gemini establish and consume truth), §6.9 (comparison), and FAQ ("When should we use Office or Google Docs with Copilot/Gemini instead of TruthLayer?"). No requirement to integrate TruthLayer with Office/Google; adopters choose the right tool per use case.

**Decided At**: 2026-01-29
```

```ctx
type: decision
id: decision-028
status: accepted
---
**Decision**: DOCX is a **projection format** alongside Markdown: export-only, for distribution (whitepapers, reports). Markdown remains the primary authoring and bidirectional projection; DOCX is generated from Markdown (Mermaid→images, then Pandoc).

**Rationale**:
- Markdown is the canonical projection for authoring and ctx-block sync; DOCX serves stakeholders who consume Word/Office.
- Same truth yields deterministic Markdown; DOCX is produced from that Markdown (or from store via Markdown), so it is a derived projection.
- Build: `node scripts/build-whitepaper-docx.js`; output: per-document DOCX in `dist/whitepaper-docx/`. Requires Pandoc and (for Mermaid) mermaid-cli (see `scripts/README.md`).

**Implementation**: Documented in `docs/core/ARCHITECTURE.md` § Projections; script and usage in `scripts/README.md`.

**Decided At**: 2026-01-29
```

```ctx
type: decision
id: decision-029
status: accepted
---
**Decision**: Support **bidirectional flow** (create, modify, comment, review) from Word/Google and provide **clear visualization of context relationships**. Implementation preferred via Office Add-in (direct API); without Add-in, use defined export/import format and sync step. Visualization: context map (diagram or table of nodes/edges) in or alongside docs; with Add-in, graph/tree view in task pane.

**Rationale**:
- Reviewers and authors should be able to work in familiar tools (Word, Google Docs, Excel) while decisions flow back into TruthLayer.
- Context is a graph; users need a clear view of nodes and relationships (goals, decisions, tasks, dependencies) when reviewing or authoring.
- Add-in gives best UX (explicit accept/reject, live context graph); export/import path supports "no extension" workflows.

**Design**: `docs/appendix/DOCX_REVIEW_INTEGRATION.md` §5 (bidirectional flow), §6 (visualization), §7 (summary and recommendation). PLAN Phase 3 items 17–18, Phase 6 item 5; tasks task-066, task-067.

**Decided At**: 2026-01-29
```

```ctx
type: decision
id: decision-030
status: accepted
---
**Decision**: Reorganize the solution around a **UX design pattern**: **human interaction** is the primary lens for design and documentation, given the high level of human interaction (explore, propose, comment, review, apply, resolve conflicts, view projections, context map).

**Rationale**:
- TruthLayer is heavily human-facing (contributors, reviewers, readers, admins) across multiple surfaces (Web, VS Code, Word/Google, CLI). Organizing by interaction patterns and roles makes the system easier to design, document, and implement consistently.
- Technical architecture (store, types, projections, API) supports these patterns; describing the system through them keeps human needs central and avoids component-only documentation.
- New features and docs can be scoped by: which interaction pattern(s), which role(s), which surface(s).

**Implementation**:
- **docs/core/UI_SPEC.md** is the canonical UX design pattern doc: roles, core interaction patterns, surfaces and pattern support, journey overview. ARCHITECTURE leads with this lens; UI_SPEC, DOCX_REVIEW, scenarios map to the same patterns. PLAN and CONTEXT reference it.

**Decided At**: 2026-01-29
```

```ctx
type: decision
id: decision-031
status: accepted
---
**Decision**: The design is **agentic-first** (clean slate). The **primary interface** is the **in-process agent** (LLM + store tools); **one minimal review/apply surface** is required for accept/reject/apply; rich UIs (Web, VS Code, Word/Google) are **optional**.

**Rationale**:
- Simplifies tooling: one agent API + one review surface instead of many full-featured clients. Thin clients (chat, voice, Slack, OpenClaw) talk to the agent; no need to build TruthLayer-specific UIs for every channel.
- The agent covers explore, propose, comment, and review-queue summary; it cannot submitReview or applyProposal, so the approval layer remains human- or policy-gated. One dedicated surface for truth-changing actions keeps the model clear and auditable.
- Optional rich surfaces remain available for teams that want full Web, VS Code, or Word/Google UX.

**Implementation**: CONTEXT.md goal-001, WHITEPAPER §1 and §4, ARCHITECTURE, UX_AND_HUMAN_INTERACTION, UI_SPEC, PLAN Phase 5 (agent loop + minimal review surface), CONTEXTUALIZED_AI_MODEL §4. All docs updated from the ground up to reflect agentic-first.

**Decided At**: 2026-01-29
```
