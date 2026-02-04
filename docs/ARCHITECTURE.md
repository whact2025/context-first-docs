# Architecture Overview

**TruthLayer** is an **Agentic Collaboration Approval Layer (ACAL)**: it lets humans and AI agents collaborate on a **solution model** (a typed graph of goals/decisions/constraints/tasks/risks/questions) and converge on **approved truth** via review-mode proposals.

**For builders:** Canonical walkthroughs — [Hello World](HELLO_WORLD_SCENARIO.md) (proposal → review → apply → Markdown), [Conflict and Merge](CONFLICT_AND_MERGE_SCENARIO.md) (conflict detection, field-level merge, staleness). Full design and product wedge: `docs/WHITEPAPER.md`. Status model (node vs proposal): whitepaper §4.1. Security posture (production today, enterprise roadmap): whitepaper §7.4, §7.5.

## System Components

### 1. Type System (`src/types/`)

The foundation of the system is a strongly-typed node and proposal system:

- **Node Types**: Define semantic concepts for solution modeling (goals, decisions, constraints, tasks, risks, questions, etc.)
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
- Graph format enables efficient relationship queries and decision/rationale traversal (provenance chains; see `docs/AGENT_API.md`)

### 2. Projections (Markdown and DOCX) (`src/markdown/`, `scripts/`)

**Markdown** is the primary projection format: bidirectional sync with the context store (authoring and export). **DOCX** is an export-only projection for distribution (e.g. whitepapers, reports).

- **Markdown** (`src/markdown/`):
  - **ctx Blocks**: Lightweight syntax for embedding semantic nodes inside Markdown
  - **Import**: Converts ctx block edits into proposals (`importFromMarkdown`)
  - **Export**: Projects accepted nodes into ctx blocks deterministically (`projectToMarkdown`)
- **DOCX**: Generated from Markdown (or from store via Markdown); Mermaid diagrams rendered to images, then Pandoc converts to DOCX. Build: `node scripts/build-whitepaper-docx.js` (see `scripts/README.md`). Output: per-document DOCX files in `dist/whitepaper-docx/`.

Key principles:
- **Review mode (no direct edits)**: clients submit proposals; reviewers accept/reject into truth (see `docs/REVIEW_MODE.md`)
- **Markdown and DOCX are projections, not truth**: whether Markdown lives in Git or only in a UI is a deployment choice; it’s never the canonical store
- **Only ctx blocks are managed** (in Markdown): other Markdown content is preserved when merging (`mergeMarkdownWithContext`)

### 3. Context Store (reference implementation + planned persistence)

The canonical source of truth (the “approval layer”):

- Stores all nodes (accepted, proposed, rejected) in graph format (the solution model)
- Manages proposals and reviews
- Provides comprehensive query interface for agents with decision/rationale traversal (provenance chains)
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

### 4. Contextualize module (contextualized AI + prompt-leakage policy)

A **first-class component** that turns the context store into the substrate for RAG, fine-tuning, and structured prompting. Store-facing orchestration (retrieval, prompt builder, export pipeline, policy layer) is **TypeScript** (`src/contextualize/*`); **Python** is used where best suited: embeddings, vector index (build/query), and fine-tuning pipelines (see `docs/CONTEXTUALIZED_AI_MODEL.md` § Position in architecture → Implementation language).

- **Scope:** Retrieval from the store, prompt building, export for fine-tuning, vector index. Sits between the context store and any LLM (self-hosted or vendor).
- **Prompt-leakage policy layer:** Policy-as-code with three elements: **sensitivity labels** on nodes/namespaces, a **retrieval policy module** (allow/deny by destination, e.g. vendor_llm vs internal_only), and **logging of node IDs** included in each prompt sent to a vendor LLM. Wraps retrieval and prompt building; the store stays agnostic.
- **Operational controls (same doc):** Topic-scoped retrieval, namespace/type allowlists, redaction, max context budget — see `docs/CONTEXTUALIZED_AI_MODEL.md` §3.3–3.4.

**Status:** Designed and documented in `docs/CONTEXTUALIZED_AI_MODEL.md`; implementation roadmap in PLAN Phase 5 (Contextualize module).

## Data Flow (Review Mode)

### Writing Context (Suggesting → Review → Apply)

1. **Client authors a suggestion**: human UI / agent produces a proposal (field updates, relationship edits, or Markdown-derived proposals)
2. **Store records proposal**: proposal remains `open` and does not change accepted truth
3. **Reviewers accept/reject**: approval is explicit (see `docs/REVIEW_MODE.md`)
4. **Apply**: accepted proposals are applied to become truth (`applyProposal`)
5. **Optional projections**: clients can render Markdown (and/or DOCX) projections and show diffs/overlays

### Reading Context

1. **Agents**: Query context store via `ContextStore` interface (never read raw Markdown)
   - Agents treat Markdown as a projection, not canonical truth
   - Storage backend is transparent to agents
   - Optional API layers (GraphQL/HTTP) can be added later; the contract is `ContextStore`
2. **Humans**: View projections in a client (editor extension, web UI, CLI)
   - Projections can be generated on-demand from accepted truth (Markdown for authoring/editing; DOCX for distribution)
   - Markdown may be client-side or committed in a repo; either way it is a projection, not canonical truth
3. Context store returns accepted nodes + open proposals (default: accepted only for safety)
4. Agent can distinguish truth from proposals (explicit status indicators)
5. Agent can create new proposals (stored in central context store)
6. **Decision/rationale traversal (provenance chains):** Agents can traverse typed relationship paths (goal → decision → task → risk), build context progressively, understand decision rationale, and discover related context; see `docs/AGENT_API.md` (not LLM chain-of-thought).
7. **Comprehensive Query API**: Query by type, status, keyword, relationships, with pagination and sorting
8. See `docs/AGENT_API.md` for full API documentation

### Review Workflow

1. Proposal is created (from Markdown edit or agent)
2. **Conflict Detection**: System checks for conflicts with open proposals
3. **Field-Level Merging**: Non-conflicting fields auto-merged, same-field conflicts flagged (v1 default: see `docs/RECONCILIATION_STRATEGIES.md`)
4. **Optimistic Locking**: Node versions checked to prevent stale updates
5. Reviewers comment and review (including anchored, Docs-style feedback on specific node fields)
6. **Multi-Approval (roadmap)**: Some proposals require multiple approvals / quorum policies
7. Proposal is accepted or rejected (v1 default: block approval on conflicts for decision/constraint-type nodes)
8. If accepted:
   - Operations are applied to store (with version validation)
   - **Issues are automatically created** (if configured - see `decision-012`; broader “action item creation” applies beyond software)
   - Issues can be created as task nodes
   - Referencing nodes updated
9. Markdown (and optionally DOCX) is regenerated from accepted truth
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

- Same context = same Markdown (and same DOCX when regenerated); deterministic output enables reproducible projections and clean diffs when Markdown is versioned
- Enables validation and drift detection
- Predictable behavior for agents
- Supports reproducible builds

### Why Graph Model? (see `decision-015`)

- More flexible than strict hierarchies
- Enables efficient relationship queries and decision/rationale traversal (provenance chains)
- Can represent complex multi-dimensional relationships
- Hierarchical views can be projected when needed

### Why Graph Format Storage? (see `decision-005`)

- Graph-native storage matches graph model
- Enables efficient relationship queries
- JSON Graph format is git-friendly and reviewable
- All data stays within organization (self-hosted)
- No external services required

### Why Hybrid Conflict Reconciliation? (see `decision-014`, `docs/RECONCILIATION_STRATEGIES.md`)

- **V1 default policy:** Field-level merge + optimistic locking + manual resolution for same-field conflicts; block approval on conflicts for decision/constraint-type nodes; last-write-wins only when explicitly configured for low-stakes text.
- Balance between automation and control
- True conflicts require human judgment

## Agent Safety

Agents never:
- Read raw Markdown directly
- Mutate accepted truth directly
- Guess at intent from unstructured text

Agents always:
- Query the context store (comprehensive API with decision/rationale traversal — provenance chains)
- Create proposals for changes
- Distinguish accepted truth from proposals (default: accepted only)
- Respect review workflows
- Use provenance chains (typed relationship paths) to understand context progressively

**Decision/rationale traversal (provenance chains):** Goal → decision → task → risk; not LLM chain-of-thought. See `docs/AGENT_API.md` for full API documentation.

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

### Conflict Reconciliation (see `decision-014`, `docs/RECONCILIATION_STRATEGIES.md`)

- **V1 default:** Field-level merge + optimistic locking + manual resolution for same-field conflicts; block approval on conflicts for decision/constraint node types; last-write-wins only when explicitly configured.
- **Conflict Detection**: At proposal creation time
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

### Security & Privacy (see `constraint-005`, `docs/WHITEPAPER.md` §7.4, §7.5)

- **Self-Hosted**: All data stays within your organization (Git-friendly file backend and/or self-hosted DB), no external services required
- **No Data Leak**: All context stays within organization
- **Air-Gapped Support**: Can work in air-gapped environments
- **Full Control**: Complete control over data location and access
- **Production posture today** (condensed): whitepaper §7.4 (gateway, approvers-only for review/apply, disable reset, log vendor prompts, audit). **Enterprise-grade roadmap**: whitepaper §7.5.

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
