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
- Graph format enables efficient relationship queries and chain-of-thought reasoning

### 2. Markdown Projection (`src/markdown/`)

Bidirectional synchronization between Markdown and the context store:

- **ctx Blocks**: Lightweight syntax for embedding semantic nodes
- **Import**: Converts Markdown edits to proposals
- **Export**: Projects accepted nodes to Markdown deterministically

Key principles:
- Markdown is a projection, not the source of truth
- Only ctx blocks are managed by the system
- Other Markdown content is preserved

### 3. Context Store (to be implemented)

The canonical source of truth:

- Stores all nodes (accepted, proposed, rejected) in graph format
- Manages proposals and reviews
- Provides comprehensive query interface for agents with chain-of-thought traversal
- Manages role-based access control
- Handles conflict detection and resolution
- Creates issues automatically when proposals are approved

**Storage Format**: JSON Graph format (`.context/graph.json`) - default storage for all collected data (see `decision-005`)
- Graph structure with nodes and edges
- Individual node files for granular access
- Committed to Git for versioning and collaboration
- All data stays within organization (self-hosted, no external services - see `constraint-005`)

Planned implementations:
- In-memory store (for testing)
- File-based store (JSON Graph format)
- Git-backed store (for versioning)
- Optional: Embedded graph databases (Kuzu, SQLite) for performance at scale

## Data Flow

### Writing Context

1. Human edits Markdown file (e.g., `DECISIONS.md`) - based on role permissions (read-only or editable)
2. System detects changes to ctx blocks and other content
3. Changes imported as proposals (for ctx blocks)
4. Non-ctx content changes tracked and synced
5. Referencing nodes updated if referenced content changed
6. Proposals are reviewed
7. Accepted proposals become truth in context store
8. All affected Markdown files regenerated from accepted truth

### Reading Context

1. Agent queries context store (never reads raw Markdown)
2. Store returns accepted nodes + open proposals (default: accepted only for safety)
3. Agent can distinguish truth from proposals (explicit status indicators)
4. Agent can create new proposals
5. **Chain-of-Thought Traversal**: Agents can traverse reasoning chains:
   - Follow logical paths: goal → decision → task → risk
   - Build context progressively as they reason
   - Understand decision rationale (goals, alternatives, implementations, risks, constraints)
   - Discover related context through multiple hops
   - Query with automatic reasoning chain traversal
6. **Comprehensive Query API**: Query by type, status, keyword, relationships, with pagination and sorting
7. See `docs/AGENT_API.md` for full API documentation

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

- Same context = same Markdown (critical for Git)
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

## VS Code/Cursor Extension (Required)

The VS Code/Cursor extension is a core component, not optional:

- **In-editor review**: Review proposals, accept/reject changes without leaving the editor
- **Context awareness**: See related decisions, risks, and tasks while coding
- **Authoring support**: Create proposals and nodes directly from the editor
- **Syntax support**: Highlight and validate ctx blocks
- **Git integration**: Link commits to proposals, track implementation

## Additional Components

### Role-Based Access Control (see `decision-011`)

- **Roles**: Contributors, approvers, admins
- **Permissions**: Create proposals, review, approve, manage users
- **Designated Approvers**: Per-node-type approvers, multi-approval workflows
- **Role-Based Markdown Editing**: Read-only vs editable based on permissions

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

### Security & Privacy (see `constraint-005`)

- **Self-Hosted**: All data in Git repository, no external services
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
- Migration tools
