# Architecture Overview

## System Components

### 1. Type System (`src/types/`)

The foundation of the system is a strongly-typed node and proposal system:

- **Node Types**: Define semantic concepts (goals, decisions, constraints, tasks, risks, questions, etc.)
- **Graph Model**: Nodes are vertices in a graph with typed relationships (edges)
- **Relationship Types**: parent-child, depends-on, references, supersedes, implements, blocks, mitigates, related-to
- **Proposal System**: Represents changes as proposals with operations
- **Context Store Interface**: Abstract interface for persistence
- **Role System**: Contributors, approvers, admins with role-based access control
- **Issue System**: Automatic issue creation from approved proposals
- **Conflict Resolution**: Hybrid reconciliation with conflict detection, field-level merging, optimistic locking

Key principles:
- Every concept is a typed node with identity
- Nodes form a graph with typed relationships (see `decision-015`)
- Changes are proposals, not direct mutations
- Status is explicit (accepted, proposed, rejected, superseded)
- Nodes support normalized text fields: optional `title` (short label), optional `description` (canonical long-form Markdown body), and required `content` as a deterministic derived plain-text index used for search/similarity/snippets
- Graph format enables efficient relationship queries and chain-of-thought reasoning

### 2. Markdown Projection (`src/markdown/`) - Optional projection format

Bidirectional synchronization between Markdown and the context store (one possible client format):

- **ctx Blocks**: Lightweight syntax for embedding semantic nodes inside Markdown
- **Import**: Converts ctx block edits into proposals (`importFromMarkdown`)
- **Export**: Projects accepted nodes into ctx blocks deterministically (`projectToMarkdown`)

Key principles:
- **Review mode (no direct edits)**: clients submit proposals; reviewers accept/reject into truth (see `docs/REVIEW_MODE.md`)
- **Markdown is a projection, not truth**: whether Markdown lives in Git or only in a UI is a deployment choice; it’s never the canonical store
- **Only ctx blocks are managed**: other Markdown content is preserved when merging (`mergeMarkdownWithContext`)

### 3. Context Store (reference implementation + planned persistence)

The canonical source of truth:

- Stores all nodes (accepted, proposed, rejected) in graph format
- Manages proposals and reviews
- Provides comprehensive query interface for agents with chain-of-thought traversal
- Manages role-based access control
- Handles conflict detection and resolution
- Creates issues automatically when proposals are approved

**Storage Format**: Dual storage options via `ContextStore` abstraction layer (see `decision-005`)
- **In-memory**: implemented baseline for dev/testing (`InMemoryStore`)
- **File-based**: planned JSON graph format (Git-friendly; intended default once implemented)
- **MongoDB**: planned self-hosted production backend (scaling/concurrency)

Planned additions:
- persistent backends (file-based, MongoDB) behind the same `ContextStore` interface
- optional API layer(s) (e.g. GraphQL/HTTP) built on top of `ContextStore`
- optional Git-based snapshot/backup for database-backed deployments

## Data Flow (Review Mode)

### Writing Context (Suggesting → Review → Apply)

1. **Client authors a suggestion**: UI/agent produces a proposal (field updates, relationship edits, or Markdown-derived proposals)
2. **Store records proposal**: proposal remains `open` and does not change accepted truth
3. **Reviewers accept/reject**: approval is explicit (see `docs/REVIEW_MODE.md`)
4. **Apply**: accepted proposals are applied to become truth (`applyProposal`)
5. **Optional projections**: clients can render Markdown projections and/or show diffs/overlays

### Reading Context

1. **Agents**: Query context store via `ContextStore` interface (never read raw Markdown)
   - Agents treat Markdown as a projection, not canonical truth
   - Storage backend is transparent to agents
   - Optional API layers (GraphQL/HTTP) can be added later; the contract is `ContextStore`
2. **Humans**: View projections in a client (editor extension, web UI, CLI)
   - Projections can be generated on-demand from accepted truth
   - Markdown may be client-side or committed in a repo; either way it is a projection, not canonical truth
3. Context store returns accepted nodes + open proposals (default: accepted only for safety)
4. Agent can distinguish truth from proposals (explicit status indicators)
5. Agent can create new proposals (stored in central context store)
6. **Chain-of-Thought Traversal**: Agents can traverse reasoning chains:
   - Follow logical paths: goal → decision → task → risk
   - Build context progressively as they reason
   - Understand decision rationale (goals, alternatives, implementations, risks, constraints)
   - Discover related context through multiple hops
   - Query with automatic reasoning chain traversal
7. **Comprehensive Query API**: Query by type, status, keyword, relationships, with pagination and sorting
8. See `docs/AGENT_API.md` for full API documentation

### Review Workflow

1. Proposal is created (from Markdown edit or agent)
2. **Conflict Detection**: System checks for conflicts with open proposals
3. **Field-Level Merging**: Non-conflicting fields auto-merged, conflicts flagged
4. **Optimistic Locking**: Node versions checked to prevent stale updates
5. Reviewers comment and review (role-based: approvers can approve/reject)
6. **Multi-Approval**: Some proposals require multiple approvals
7. Proposal is accepted or rejected
8. If accepted:
   - Operations are applied to store (with version validation)
   - **Issues are automatically created** (if configured - see `decision-012`)
   - Issues can be created as task nodes
   - Referencing nodes updated
9. Markdown is regenerated from accepted truth
10. **Conflict Resolution**: True conflicts require manual resolution by reviewers

## Key Design Decisions

### Why Proposals, Not Diffs?

- Proposals preserve intent and rationale
- Review is a first-class operation
- Rejected proposals are preserved for provenance
- Enables partial accept/reject

### Why ctx Blocks?

- Lightweight and non-intrusive
- Stable IDs survive rebases and merges
- Clear ownership (system vs human)
- Renders correctly even if ignored

### Why Deterministic Projection?

- Same context = same Markdown (deterministic; enables reproducible projections and clean diffs when Markdown is versioned)
- Enables validation and drift detection
- Predictable behavior for agents
- Supports reproducible builds

### Why Graph Model? (see `decision-015`)

- More flexible than strict hierarchies
- Enables efficient relationship queries and traversal
- Supports chain-of-thought reasoning for agents
- Can represent complex multi-dimensional relationships
- Hierarchical views can be projected when needed

### Why Graph Format Storage? (see `decision-005`)

- Graph-native storage matches graph model
- Enables efficient relationship queries
- JSON Graph format is git-friendly and reviewable
- All data stays within organization (self-hosted)
- No external services required

### Why Hybrid Conflict Reconciliation? (see `decision-014`)

- No single strategy fits all use cases
- Balance between automation and control
- Field-level conflicts often resolvable automatically
- True conflicts require human judgment
- Optimistic locking prevents stale updates

## Agent Safety

Agents never:
- Read raw Markdown directly
- Mutate accepted truth directly
- Guess at intent from unstructured text

Agents always:
- Query the context store (comprehensive API with chain-of-thought traversal)
- Create proposals for changes
- Distinguish accepted truth from proposals (default: accepted only)
- Respect review workflows
- Follow reasoning chains to understand context progressively

**Chain-of-Thought Reasoning**:
- Agents can traverse logical reasoning chains (goal → decision → task → risk)
- Build context progressively as they reason
- Understand decision rationale and alternatives
- Discover related context through graph traversal
- See `docs/AGENT_API.md` for full API documentation

## Clients (not coupled to a specific UI)

Any client can participate as long as it follows review-mode semantics:

- VS Code/Cursor extension
- Web UI
- CLI tooling
- Agents (via the `ContextStore` API)

## Additional Components

### Role-Based Access Control (see `decision-011`)

- **Roles**: Contributors, approvers, admins
- **Permissions**: Create proposals, review, approve, manage users
- **Designated Approvers**: Per-node-type approvers, multi-approval workflows
- **Role-Based Markdown Editing**: Read-only vs **suggesting** based on permissions (accept/reject requires approver role)

### Conflict Reconciliation (see `decision-014`)

- **Conflict Detection**: Detect conflicts at proposal creation time
- **Field-Level Merging**: Auto-merge non-conflicting fields
- **Optimistic Locking**: Track node versions, reject stale proposals
- **Manual Resolution**: True conflicts require human review
- **Proposal Superseding**: Allow explicit superseding relationships

### Issue Creation System (see `decision-012`)

- **Automatic Creation**: Issues created when proposals are approved
- **Templates**: Configurable issue templates
- **Task Nodes**: Issues can be created as task nodes in context store
- **Traceability**: Issues reference originating proposals
- **Codebase projection**: Issues may carry an optional `codeProjection` (PR/branch/patch/plan) to show the expected/actual code changes that implement the approved proposal

### Security & Privacy (see `constraint-005`)

- **Self-Hosted**: All data stays within your organization (Git-friendly file backend and/or self-hosted DB), no external services required
- **No Data Leak**: All context stays within organization
- **Air-Gapped Support**: Can work in air-gapped environments
- **Full Control**: Complete control over data location and access

## Future Extensions

- Real-time collaboration
- GitHub/GitLab integration
- GraphQL API for flexible querying
- REST API endpoint for HTTP access
- WebSocket API for real-time updates
- Advanced graph algorithms (shortest path, centrality, etc.)
- Machine learning for semantic similarity detection
- Cross-reference resolution
- Validation rules
- Reverse engineering tools for extracting historical context
