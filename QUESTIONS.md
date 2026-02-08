# Open Questions

This document tracks questions that need answers as the project evolves. Each question is in a **ctx block** (fenced code block with language `ctx`) for machine-readable structure.

- **Product:** TruthLayer = **Ratify truth. AI with Guardrails for Security & Compliance**; we build **The Agent** (reads truth, creates proposals; humans ratify). One minimal governance UI required; rich UIs optional.
- **Walkthroughs:** [Hello World](docs/scenarios/HELLO_WORLD_SCENARIO.md), [Conflict and Merge](docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md).
- **The Agent (Phase 5):** `docs/appendix/CONTEXTUALIZED_AI_MODEL.md`, PLAN Phase 5.
- **Security & Compliance:** `docs/WHITEPAPER.md`, `docs/reference/SECURITY_GOVERNANCE.md` (including agent-behavior guardrails: personal data sensitivity, truth scope discipline, immutability with redaction, trade secret awareness, external model boundary, heightened review triggers, retention awareness, provenance and justification, workspace isolation, when in doubt propose don’t apply).
- **Doc suite / Word:** whitepaper §2.4, §6.9, decision-027; `docs/appendix/DOCX_REVIEW_INTEGRATION.md` §5–7, decision-029.

## Before Phase 2 (Persistence & Storage)

- **question-038** resolved: server-centric config root (storage, RBAC, runtime) in a predefined location relative to the server. **question-007** (roles) resolved: deployment-specific; RBAC provider abstraction (Git/GitLab, Azure AD, DLs, or any configured provider).
- **question-006** (issue creation) resolved: explicit optional path; approval blocked until issues created or user retries.
- **question-011** (namespaces) can be deferred: implement workspaceId-only first.

## Design blockers

Open questions that block specific design or implementation decisions:

| Question         | Blocks                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| **question-008** | Multi-approval workflow semantics (when approvers disagree) → REVIEW_MODE, UI_SPEC                                 |
| **question-010** | Withdraw/reopen proposal lifecycle → REVIEW_MODE, proposal state machine                                           |
| **question-034** | Agent attribution in audit log → SECURITY_GOVERNANCE, AGENT_API                                                    |
| **question-035** | Guarantee agent never receives submitReview/applyProposal (enforcement) → AGENT_API safety section, tool allowlist |

Resolving these will allow the referenced docs to be finalized where they depend on the answers.

## Security & compliance (guardrail implementation)

Open questions that affect how guardrail behavior is implemented or surfaced:

| Question         | Topic                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **question-039** | How should heightened-review recommendations (policy, security, legal, pricing, IP, personal data, access expansion) be surfaced to agents and UIs—metadata on proposals, tool hints, or policy engine only? |
| **question-040** | How should “when in doubt, propose, don’t apply” be reflected in agent tooling—e.g. explicit uncertainty flags on proposals, or guidance only in agent docs/prompts?                                         |
| **question-041** | How to enforce or recommend workspace isolation in retrieval and prompt building (no cross-workspace context unless authorized)?                                                                             |

See `docs/reference/SECURITY_GOVERNANCE.md` for the full set of guardrail sections (Personal data sensitivity through When in doubt, propose, don’t apply).

---

## Questions (ctx blocks)

Each question is in a **ctx block** (metadata + body after `---`). Use the **Cursor/VS Code extension** in this repo to render ctx blocks in the markdown preview (bold, lists, etc.).

```ctx
type: question
id: question-001
status: resolved
---
**Question**: Should Markdown files be read-only (generated only) or editable?

**Answer**: Both modes should be supported based on role. Markdown editing must sync back to any referencing context.

**Resolution**:
- **Read-only mode**: For contributors/approvers who should only review, not edit
- **Editable mode**: For contributors/approvers with edit permissions
- **Role-based**: Mode determined by user role and permissions
- **Sync requirement**: All Markdown edits must sync back to context store and update any referencing nodes
- **Bidirectional**: Changes flow both ways - store → Markdown and Markdown → store

**Impact**: High - affects core workflow design
```

````ctx
type: question
id: question-002
status: resolved
---
**Question**: How should we handle conflicts when multiple people edit the same ctx block?

**Answer**: Hybrid approach combining conflict detection, field-level merging, manual resolution, optimistic locking, and proposal superseding.

**Resolution** (see `docs/appendix/RECONCILIATION_STRATEGIES.md`):
- **Conflict Detection**: Detect conflicts at proposal creation time
- **Field-Level Merging**: Auto-merge non-conflicting fields, flag conflicting fields
- **Manual Resolution**: Require human review for true conflicts
- **Optimistic Locking**: Track node versions, reject stale proposals
- **Proposal Superseding**: Allow explicit superseding relationships

**Workflow**:
1. User creates proposal → System checks for conflicts with open proposals
2. If no conflicts → Normal review workflow
3. If field-level conflicts → Auto-merge non-conflicting fields, flag conflicts
4. If true conflicts → Mark proposal as "conflict", require manual resolution
5. Reviewer sees all conflicting proposals, creates merged proposal or chooses one
6. System applies resolution with version checking

**Impact**: High - affects collaboration model

```ctx
type: question
id: question-003
status: resolved
---
**Question**: Should we support nested or hierarchical nodes?

**Answer:** Use a graph model with typed relationships instead of strict nesting.

**Resolution:**
- **Graph Model:** Nodes are vertices, relationships are typed edges
- **Typed Relationships:** Support multiple relationship types (parent-child, depends-on, references, supersedes, related-to, etc.)
- **Flexibility:** Can represent hierarchies, dependencies, references, and other relationships in a unified way
- **Query Power:** Graph queries enable traversal, path finding, and relationship analysis
- **Hierarchical Views:** Can project graph into hierarchical views when needed (e.g. "show subtasks", "show sub-decisions")
- **No Strict Nesting:** Avoids rigid parent-child constraints that limit flexibility

**Relationship Types:**
- `parent-child`: For hierarchical relationships (sub-decisions, subtasks)
- `depends-on`: For dependencies (task dependencies, decision dependencies)
- `references`: For references (decisions referencing goals, tasks referencing decisions)
- `supersedes`: For replacement relationships (new decision supersedes old)
- `related-to`: For general relationships
- `implements`: For implementation relationships (task implements decision)
- `blocks`: For blocking relationships (risk blocks task)
- `mitigates`: For mitigation relationships (task mitigates risk)

**Benefits:**
- More flexible than strict hierarchies
- Can represent complex multi-dimensional relationships
- Enables powerful graph queries and traversal
- Supports both hierarchical and non-hierarchical structures
- Can evolve relationship types without schema changes
- Better for AI agents to understand context and relationships

**Implementation:**
- Replace simple `relations?: NodeId[]` with typed edge structure
- Store edges separately or embedded in nodes (both approaches viable)
- Support graph queries: "find all descendants", "find all dependencies", "find path between nodes"
- Provide hierarchical projection APIs for UI/display purposes

**Impact:** Medium — affects data model complexity, but provides more power and flexibility

```ctx
type: question
id: question-004
status: resolved
---
**Question**: What's the best format for storing context in Git? JSON vs YAML vs custom? Should graph/document databases be considered?

**Answer**: Both file-based and MongoDB storage implementations are available through a storage abstraction layer (`ContextStore` interface). Users can start with file-based and scale up to MongoDB.

**Storage Abstraction Layer**:
- **Interface**: `ContextStore` interface defines storage contract
- **Multiple Implementations**: Both file-based and MongoDB satisfy the same interface
- **Configuration-Based**: Users select storage backend via configuration
- **Seamless Scaling**: Switch from file-based to MongoDB without code changes

**File-Based Storage** (Intended default for development/small projects):
- **Format**: JSON graph format (example path: `.context/graph.json`) and optional per-node files
- **Location**: implementation-defined; `.context/` is a common default
- **Benefits**:
  - Simple, no external dependencies
  - Fully Git-friendly, reviewable in PRs
  - Perfect for small projects and development
  - Easy to understand and debug
- **Limitations**:
  - Concurrency issues with multiple simultaneous edits
  - Scalability concerns with large graphs

**MongoDB Storage** (Recommended for Production/Large Projects):
- **Database**: Self-hosted MongoDB (within organization)
- **API Layer**: GraphQL API for type-safe queries and mutations
- **Schema**: GraphQL schema versioned in your repo (path is implementation-defined)
- **Collections**: `nodes`, `proposals`, `reviews`, `relationships`
- **Benefits**:
  - ACID transactions for atomic proposal approvals
  - Concurrency control (optimistic locking, no file conflicts)
  - Scalability (indexed queries, horizontal scaling)
  - Production-ready (proper database with transactions, indexing, scaling)
- **Git Integration**: Periodic snapshots to Git repository for backup, version history, audit trail

**Decision**:
- **Both Implementations**: File-based (intended default) and MongoDB (production) both available
- **Abstraction Layer**: `ContextStore` interface allows seamless switching
- **Scaling Path**: Start with file-based, scale up to MongoDB via configuration
- **Architecture**: Storage abstraction enables multiple implementations

**Impact**: High - fundamental architectural decision enabling scalability path

**Updated At**: 2026-01-26 (support both file-based and MongoDB via abstraction layer)
````

```ctx
type: question
id: question-005
status: resolved
---
**Question**: How should agents discover and consume context?

**Answer**: Comprehensive query API with decision/rationale traversal (provenance chains) capabilities. See `docs/core/AGENT_API.md` for full API design.

**Discovery API**:
- **Query by Type, Status, Keyword**: `queryNodes()` with comprehensive filtering
  - Filter by node types (decision, task, risk, etc.)
  - Filter by status (accepted, proposed, rejected, superseded)
  - Full-text search with advanced options (fields, operators, fuzzy matching)
  - Tag, namespace, creator, date range filtering
  - Pagination and sorting support

- **Graph Traversal**: Relationship-based queries
  - Find related nodes by relationship types
  - Traverse dependencies, descendants, ancestors
  - Filter by relationship existence and direction
  - Depth-controlled traversal

- **Decision/rationale traversal (provenance chains)**: Progressive context building via typed relationships
  - `traverseReasoningChain()`: Follow logical relationship paths (goal → decision → task → risk)
  - `buildContextChain()`: Build context progressively by following relationship sequences
  - `followDecisionReasoning()`: Understand decision rationale (goals, alternatives, implementations, risks, constraints)
  - `discoverRelatedReasoning()`: Find related context through multiple hops and semantic similarity
  - `queryWithReasoning()`: Query with automatic provenance chain traversal
  - Accumulates context progressively as agents reason
  - Includes rationale and alternatives at each step

**Agent Safety**:
- **Default Behavior**: Queries return only accepted nodes (truth) by default
- **Explicit Opt-in**: Agents must explicitly include proposals: `status: ["accepted", "proposed"]`
- **Clear Status Indicators**: All nodes include explicit status field
- **Reasoning Paths**: Decision/rationale traversal (provenance chains) shows step-by-step reasoning with rationale

**API Structure**:
- Programmatic interface (TypeScript/JavaScript)
- Returns `NodeQueryResult` with pagination metadata
- Supports complex multi-filter queries
- Graph-native queries for relationship traversal
- Decision/rationale traversal (provenance chain) queries for progressive context building

**Authentication/Authorization**:
- To be determined (see `question-007` for role management)
- Current design supports role-based access control (see `decision-011`)
- Query API can be extended with authentication/authorization checks

**Examples**:
- Basic query: `queryNodes({ type: ["decision"], status: ["accepted"], search: "TypeScript" })`
- Provenance chain: `traverseReasoningChain(startNode, { path: [...], accumulateContext: true })`
- Query with reasoning: `queryWithReasoning({ query: {...}, reasoning: { enabled: true } })`

**Impact**: High - core to agent safety and reasoning capabilities
```

```ctx
type: question
id: question-006
status: resolved
---
**Question**: What happens if issue creation fails when a proposal is approved?

**Answer**: Issue generation is an **optional path** with an **explicit flow**. If the proposal is configured to create issues on approval, approval remains **blocked** until issue generation succeeds. On failure, the user can **retry**; approval does not complete until issues are created successfully (or the optional path is skipped/removed from the proposal). Integrations are pluggable: Git issues (GitHub, GitLab, etc.), Jira, and others.

**Resolution**:
- **Explicit path**: Proposals can optionally specify "create issues on approval"; the UI/workflow shows this step clearly (e.g. "Create issues → Review → Apply" or "Apply (with issue creation)").
- **On failure**: Automatic issue creation fails (permissions, validation, API down, etc.) → approval stays blocked; user sees failure reason and can **retry** (same or corrected config). No silent skip; no "approve now, issues later" unless we explicitly add a "skip issue creation" action for that proposal.
- **Optional**: Issue generation is not required for every proposal; only when the proposal (or template) requests it. Supports Git issues (GitHub, GitLab, etc.), Jira, and other backends via pluggable integrations.

**Impact**: High - affects approval workflow reliability
```

```ctx
type: question
id: question-007
status: resolved
---
**Question**: How are user roles assigned and managed?

**Answer**: Role assignment is **deployment-specific**. A clear **RBAC provider abstraction** lets each deployment plug in the appropriate source of roles; the system consumes a unified role model (Reader, Contributor, Reviewer, Applier, Admin) regardless of provider.

**Resolution**:
- **Abstraction layer**: Define an RBAC provider interface (e.g. resolve roles for actor/workspace). The store and GraphQL layer call this interface; they do not hard-code Git vs Azure AD.
- **Git / GitLab**: When Git or GitLab is the deployment context, use roles from that system (e.g. repo/org permissions, merge-request roles) as the provider. Map to TruthLayer roles (Reader, Contributor, Reviewer, Applier, Admin) as configured.
- **Enterprise**: In enterprise deployments, the provider can be **Azure AD**, **DLs (distribution lists)**, or any external system configured as the RBAC provider. SSO/OIDC identity is mapped to roles via the configured provider.
- **Provider selection**: Deployment configuration chooses which provider is used (and any provider-specific config). No single default; deployment-specific.
- **Per-workspace**: Role resolution is per workspace (and optionally per scope); the provider returns roles for (actor, workspaceId) or equivalent.

**Impact**: High - affects access control and governance
```

```ctx
type: question
id: question-008
status: open
---
**Question**: What happens in multi-approval workflows when approvers disagree?

**Context**:
- Some proposals require multiple approvals
- What if one approver approves but another rejects?
- Does rejection override approval?
- Can approvers see each other's reviews before deciding?
- How do you handle partial approval (some operations approved, others rejected)?

**Impact**: High - affects review workflow and conflict resolution
```

```ctx
type: question
id: question-009
status: open
---
**Question**: Where are issue templates stored and how are they versioned?

**Context**:
- Issue templates define what issues to create on approval
- Should templates be in `.context/templates/`?
- Can templates be shared across repositories?
- How are template changes versioned?
- Can proposals reference templates that don't exist yet?
- Template inheritance or composition?

**Impact**: Medium - affects issue creation system design
```

```ctx
type: question
id: question-010
status: open
---
**Question**: Can proposals be withdrawn or reopened after rejection?

**Context**:
- Proposal status includes "withdrawn" but workflow unclear
- Can author withdraw their own proposal?
- Can rejected proposals be reopened with changes?
- Should withdrawn/rejected proposals be editable?
- What's the lifecycle of a proposal?

**Impact**: Medium - affects proposal management
```

```ctx
type: question
id: question-011
status: open
---
**Question**: How do namespaces work and what's their scope?

**Context**:
- Nodes can have optional namespaces
- Are namespaces per-repository? Per-organization?
- Can namespaces have their own approvers?
- How do you query across namespaces?
- Namespace inheritance or isolation?
- Default namespace behavior?

**Impact**: Medium - affects organization and querying
```

```ctx
type: question
id: question-012
status: resolved
---
**Question**: What happens when the context store grows very large (thousands of nodes)?

**Answer**: File-based storage has limitations; MongoDB storage scales better. Both support pagination and indexing.

**Resolution**:
- **File-Based Storage**:
  - Performance degrades with large graphs (>1000 nodes)
  - Pagination supported (limit/offset in queries)
  - Index file helps but still requires parsing graph.json
  - Recommendation: Use for <1000 nodes, migrate to MongoDB for larger
- **MongoDB Storage**:
  - Scales to thousands/millions of nodes
  - Indexed queries for fast performance
  - Pagination built-in
  - Horizontal scaling possible
- **Both**:
  - Pagination: Default limit 50, max 1000
  - Lazy loading: Load nodes on-demand
  - Archival: Mark old nodes as "archived" status, can query separately
  - Performance benchmarks: TBD during implementation

**See**: `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` for scalability details

**Impact**: Medium - affects scalability
```

```ctx
type: question
id: question-013
status: resolved
---
**Question**: How do you handle conflicting proposals that modify the same node?

**Answer**: Hybrid conflict detection and resolution approach - detect conflicts, field-level merging, optimistic locking, manual resolution.

**Resolution** (see `decision-014` and `docs/appendix/RECONCILIATION_STRATEGIES.md`):
- **Conflict Detection**: System detects conflicts at proposal creation/approval time
- **Field-Level Merging**: Auto-merge non-conflicting fields, flag conflicting fields
- **Optimistic Locking**: Track node versions, reject stale proposals
- **Manual Resolution**: True conflicts require human review and resolution
- **Proposal Superseding**: Proposals can explicitly supersede others
- **Approval Prevention**: System prevents approval of conflicting proposals until resolved
- **Merge Strategy**: Field-level merging with manual resolution for conflicts

**Implementation**: See Phase 6 in `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`

**Impact**: High - affects data integrity
```

```ctx
type: question
id: question-014
status: resolved
---
**Question**: How are proposals and nodes searched and discovered?

**Answer**: Comprehensive query API with full-text search, structured queries, and GraphQL API.

**Resolution** (see `docs/core/AGENT_API.md`):
- **Query API**: `queryNodes()` and `queryProposals()` with comprehensive filtering
- **Full-Text Search**: Search across content, decision fields, with fuzzy matching
- **Structured Queries**: Filter by type, status, tags, namespace, creator, date ranges
- **Relationship Queries**: Find nodes by relationships, traverse graph
- **GraphQL API**: Type-safe queries via GraphQL (works with both storage backends)
- **Search Performance**:
  - File-based: In-memory search (load graph.json)
  - MongoDB: Text indexes for fast full-text search
- **Pagination**: Built-in pagination support (limit/offset)

**See**: `docs/core/AGENT_API.md` for full API documentation and `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` for implementation

**Impact**: Medium - affects usability
```

```ctx
type: question
id: question-015
status: resolved
---
**Question**: Can approved proposals be rolled back or superseded?

**Answer**: Yes - proposals can be superseded, and system tracks proposal history and dependencies.

**Resolution**:
- **Superseding**: New proposals can explicitly supersede old proposals (via `supersedes` relationship)
- **Status Tracking**: Old proposals marked as "superseded" status
- **Proposal History**: Full review history tracked, proposal dependencies tracked
- **Rollback**: Create new proposal that reverses changes (no direct rollback, use proposal workflow)
- **Dependencies**: System tracks proposal dependencies and superseding relationships
- **Workflow**: Create new proposal → Mark as superseding old → Review → Approve → Old marked superseded

**Implementation**: See `decision-014` and Phase 6 in `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`

**Impact**: High - affects change management
```

```ctx
type: question
id: question-016
status: resolved
---
**Question**: What validation happens on proposals before they can be created?

**Answer**: Multi-level validation - structure, content, references, with clear error messages.

**Resolution**:
- **Structure Validation**: Validate proposal structure matches schema
- **Content Validation**: Required fields, format validation (dates, IDs, etc.)
- **Reference Validation**: Check referenced nodes exist, validate relationship types
- **Version Validation**: Check node versions for optimistic locking
- **Conflict Detection**: Check for conflicts with open proposals
- **Validation Errors**: Block proposal creation with clear error messages
- **Warnings**: Non-blocking issues (e.g., referenced node is deprecated)

**Implementation**: Validation in `createProposal()` method, see Phase 6 in `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`

**Impact**: Medium - affects data quality
```

```ctx
type: question
id: question-017
status: open
---
**Question**: How are contributors and approvers notified of proposals?

**Context**:
- Need notification system for new proposals
- Notification for reviews and approvals
- Email? In-app? GitLab/GitHub notifications?
- Notification preferences?
- Digest vs immediate notifications?

**Impact**: Medium - affects collaboration and responsiveness
```

```ctx
type: question
id: question-018
status: open
---
**Question**: How do you prevent agents from creating too many proposals (rate limiting)?

**Context**:
- Agents might spam proposals
- Need rate limiting or quotas
- Per-agent limits? Per-user limits?
- How to distinguish agent vs human proposals?
- Should there be proposal batching or cooldowns?

**Impact**: Medium - affects system stability and spam prevention
```

```ctx
type: question
id: question-019
status: resolved
---
**Question**: What happens if context store JSON files are corrupted or invalid?

**Answer**: Implement validation, corruption detection, and recovery mechanisms for both storage backends.

**Resolution**:
- **File-Based Storage**:
  - JSON schema validation on read/write
  - Corruption detection (try-catch on parse, validate structure)
  - Recovery: Restore from Git history, rebuild from index.json
  - Validation on both load and write
  - Backup: Git provides version history
- **MongoDB Storage**:
  - MongoDB schema validation rules
  - Corruption detection: Database integrity checks, validation on queries
  - Recovery: Restore from Git snapshots, MongoDB backup/restore tools
  - Validation: On write (MongoDB validation), periodic integrity checks
  - Backup: Git snapshots + MongoDB native backups

**See**: `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` for implementation details

**Impact**: High - affects data integrity and reliability
```

```ctx
type: question
id: question-020
status: open
---
**Question**: How does this integrate with external tools (Jira, Linear, GitHub Issues)?

**Context**:
- Many teams use existing issue trackers
- Should issues sync to external tools?
- Bidirectional sync or one-way?
- How to handle conflicts between systems?
- Integration APIs and webhooks?

**Impact**: Medium - affects adoption and workflow integration
```

```ctx
type: question
id: question-021
status: open
---
**Question**: Can you perform bulk operations on proposals (approve/reject multiple)?

**Context**:
- Might want to approve multiple related proposals
- Bulk reject for cleanup
- Bulk status changes
- How to handle partial failures?
- UI/CLI support for bulk operations?

**Impact**: Low - affects efficiency for power users
```

```ctx
type: question
id: question-022
status: open
---
**Question**: How are proposal and node templates defined and used?

**Context**:
- Templates for common proposal types
- Templates for node creation
- Where are templates stored?
- Template variables and placeholders?
- Template inheritance or composition?
- Default templates vs custom templates?

**Impact**: Low - affects authoring efficiency
```

```ctx
type: question
id: question-023
status: resolved
---
**Question**: What's the versioning strategy if the storage format changes?

**Answer**: Versioned schemas with migration tools and backward compatibility.

**Resolution**:
- **Schema Versioning**: GraphQL schema versioned in `.context/schema.graphql`
- **Format Versioning**: Storage format includes version field in index.json/MongoDB metadata
- **Backward Compatibility**: Support reading older formats, write in current format
- **Migration Tools**: Scripts to migrate between format versions
- **Breaking Changes**: Major version bumps, migration required
- **Validation**: Schema validation on load, version checks
- **Rollback**: Keep old format readers, can export to old format if needed

**Implementation**: See Phase 2 and Phase 4 in `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`

**Impact**: Medium - affects long-term maintenance
```

```ctx
type: question
id: question-024
status: resolved
---
**Question**: How do you export and backup the context store?

**Answer**: Multiple backup strategies - Git (file-based), Git snapshots (MongoDB), and export tools.

**Resolution**:
- **File-Based Storage**:
  - Backup: Git provides full version history
  - Export: JSON format (graph.json + node files)
  - Full export: Export entire context store
  - Incremental: Git commits provide incremental history
- **MongoDB Storage**:
  - Backup: Git snapshots (periodic) + MongoDB native backups
  - Export: JSON format (same as file-based)
  - Full export: Export entire database to JSON
  - Incremental: Git snapshots provide incremental history
- **Export Formats**: JSON (primary), YAML (optional), Markdown and DOCX (projection only)
- **Backup Frequency**: Configurable (daily, milestone-based, manual)
- **Retention**: Git history provides long-term retention
- **Disaster Recovery**: Restore from Git (file-based) or Git snapshots + MongoDB backups

**Implementation**: See Phase 10 in `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`

**Impact**: Medium - affects data safety and portability
```

```ctx
type: question
id: question-025
status: open
---
**Question**: What happens to issues when their originating proposal is superseded or rolled back?

**Context**:
- Issues are created from approved proposals
- If proposal is superseded, should issues be cancelled?
- Should issues reference the proposal for traceability?
- Issue lifecycle independent of proposal?
- How to handle orphaned issues?

**Impact**: Medium - affects issue management and traceability
```

```ctx
type: question
id: question-026
status: resolved
---
**Question**: Should we use GraphQL with a self-hosted document database instead of file-based storage?

**Answer**: Yes - MongoDB (self-hosted document database) with GraphQL API is now the primary storage.

**Resolution**:
- **Both implementations available**: File-based (intended default) and MongoDB (production)
- **Storage abstraction layer**: `ContextStore` interface allows multiple implementations
- **Scaling path**: Start with file-based, scale up to MongoDB via configuration
- **GraphQL API layer** works with both storage backends
- **Git integration**: File-based uses Git directly, MongoDB uses periodic Git snapshots
- Solves concurrency/scalability issues when using MongoDB
- Maintains zero IP leakage (all infrastructure self-hosted within organization)
- Constraint-005 allows both file-based (Git) and self-hosted databases

**See**: `docs/engineering/storage/STORAGE_ARCHITECTURE.md` for detailed architecture and `decision-005` for full decision rationale

**Impact**: High - fundamental architectural decision affecting concurrency, scalability, and operations

**Decided At**: 2026-01-26
```

```ctx
type: question
id: question-027
status: resolved
---
**Question**: Should we extract reusable store logic from `InMemoryStore` so file-based and MongoDB providers can share the same domain semantics?

**Answer**: Yes. Provider-agnostic behavior (apply/query/traversal/conflicts/stale/merge) should live in a shared core module, with providers focused on persistence/indexing.

**Resolution**:
- `src/store/core/*` is the canonical implementation for shared semantics (see `decision-017`).
- Future stores should reuse core functions wherever possible to avoid divergence.

**Impact**: High - affects maintainability and cross-provider correctness
**Resolved At**: 2026-01-27
```

```ctx
type: question
id: question-028
status: open
---
**Question**: When a ctx block fails validation (invalid `type`/`status`), should the UI fail hard, warn, or auto-fix?

**Context**:
- Parsing is now strict and invalid values are rejected (fail-closed).
- Silent drops are confusing; hard failures can block workflows.
- Auto-fix requires a mapping strategy and could cause unintended changes.

**Options**:
- Warn inline and keep the block highlighted until fixed
- Offer quick-fix suggestions (closest valid enum value)
- Provide a strict-mode toggle (CI vs local authoring)

**Impact**: Medium - affects authoring UX and data integrity
```

```ctx
type: question
id: question-029
status: open
---
**Question**: Where do sensitivity labels for prompt-leakage control live, and who can set them?

**Context**:
- CONTEXTUALIZED_AI_MODEL §3.4 defines sensitivity labels on nodes/namespaces (e.g. public, internal, confidential) so the retrieval policy can allow/deny by destination (e.g. vendor_llm).
- Labels could live in node metadata (e.g. `metadata.tags` or `metadata.sensitivity`) or in a separate policy store keyed by node ID/namespace.
- Who assigns labels? Authors at create time? Admins only? Default for unlabeled nodes (deny for vendor_llm vs allow)?

**Impact**: Medium - affects Phase 5 policy interface and risk-012 mitigation
```

```ctx
type: question
id: question-030
status: open
---
**Question**: How is fine-tuning export guaranteed to include only accepted context, and how is export versioning recorded for audit?

**Context**:
- Export pipeline (Phase 5, Path B) must not send proposed/rejected nodes to training; model must not see drafts as truth.
- Query defaults to `status: ["accepted"]` but export code could override; need explicit contract and possibly validation.
- CONTEXTUALIZED_AI_MODEL says attach export timestamp/snapshot so you know which context version a fine-tuned model was trained on (reproducibility and audit).

**Impact**: High - affects enterprise IP and compliance (risk-012, decision-025)
```

```ctx
type: question
id: question-032
status: resolved
---
**Question**: When should we use TruthLayer vs Office/Google Docs + Copilot/Gemini (doc suite)?

**Answer**: TruthLayer is complementary to the doc suite feature set; we do not replace it. Use the doc suite + Copilot/Gemini for **document-centric** truth (policy, contracts, SOPs, strategy playbooks) and consumption across the full suite and messaging (Teams, Chat, Slack, email), including drafting discussions and emails. Use TruthLayer for **solution modeling** and **agent-safe structured truth**: typed graph (goals, decisions, risks, tasks), proposal/review/apply semantics, accepted-only reads, deterministic projection, provenance, self-hosted contextualized AI with prompt-leakage policy. Many organizations use both.

**Resolution**: See `DECISIONS.md` decision-027, `docs/WHITEPAPER.md` §2.4 (use cases), §6.9 (comparison), and FAQ "When should we use Office or Google Docs with Copilot/Gemini instead of TruthLayer?". PLAN Phase 6 includes documenting "when to use which" for adopters.

**Resolved At**: 2026-01-29
```

```ctx
type: question
id: question-033
status: resolved
---
**Question**: How will review and authoring from Word/Google work, and how do we visualize context relationships?

**Answer**: Bidirectional flow (create, modify, comment, review) from Word/Google is supported by mapping doc actions to the store API; preferred path is an Office Add-in (direct API), with export/import + sync as fallback. Context relationships are visualized via a context map (diagram or table of nodes/edges) in or alongside docs; with an Add-in, a graph/tree view in the task pane gives an interactive, up-to-date view.

**Resolution**: See `docs/appendix/DOCX_REVIEW_INTEGRATION.md` (bidirectional flow), §6 (visualization), §7 (summary); `DECISIONS.md` decision-029; PLAN Phase 3 items 17–18, Phase 6 item 5; tasks task-066, task-067.

**Resolved At**: 2026-01-29
```

```ctx
type: question
id: question-031
status: open
---
**Question**: When using an optional vector index (Phase 5, Path A at scale), who triggers rebuild and how is index staleness handled?

**Context**:
- Index is built from accepted nodes’ text; store is source of truth.
- Rebuild could be on every write, periodic, or manual; each has latency and cost tradeoffs.
- Retrieval could return stale context if index is behind store; should retrieval response include "index as of" or "store snapshot" for transparency?

**Impact**: Medium - affects RAG quality and auditability
```

```ctx
type: question
id: question-034
status: open
---
**Question**: How is **The Agent** (we build it) attributed in the audit log when it creates a proposal?

**Context**:
- SECURITY_GOVERNANCE says every action is attributed to an Actor; agents authenticate as `type=AGENT` with least privilege.
- Need a stable agent identity (e.g. agentId, deploymentId) so audit trail shows "proposal created by Agent X" and supports compliance.
- Multiple agent instances (e.g. per workspace or per team)? How do we namespace or identify them in audit and RBAC?

**Impact**: Medium - affects audit and compliance (guardrails)
```

```ctx
type: question
id: question-035
status: open
---
**Question**: How do we guarantee the agent never receives submitReview or applyProposal as tools?

**Context**:
- The agent is **human-directed**: it receives explicit human requests and acts accordingly (e.g. "draft a proposal for X", "find decisions about Y"). It can read truth and create/update proposals in response to those requests.
- The agent must **never** have submitReview or applyProposal as tools—ratification stays with humans in the governance UI, even when a human asks the agent to "help get this approved" (the human must perform review/apply themselves).
- Is enforcement purely by API (agent is never given those endpoints) or do we need runtime checks (reject if actor type=AGENT)?
- Should the agent-facing API be a strict subset of the full store API with those methods omitted?

**Impact**: High - affects security and guardrails
```

```ctx
type: question
id: question-036
status: open
---
**Question**: For **The Agent** we build, is the LLM always self-hosted or do we support vendor LLM with prompt-leakage policy?

**Context**:
- CONTEXTUALIZED_AI_MODEL allows vendor LLM with prompt-leakage policy (sensitivity labels, retrieval policy, logging).
- Self-hosted keeps all IP in-house; vendor can reduce ops but requires strict policy and possibly redaction.
- Default recommendation for enterprise (Security & Compliance)? Can both be supported with clear configuration?

**Impact**: Medium - affects Phase 5 implementation and positioning
```

```ctx
type: question
id: question-037
status: open
---
**Question**: How do we measure or improve **The Agent** proposal quality (e.g. acceptance rate, human feedback, rollbacks)?

**Context**:
- We build the agent; we may want to tune retrieval, prompts, or model based on outcomes.
- Metrics: proposal acceptance rate, time-to-ratify, superseded/rejected rate, human edit rate after apply.
- Do we support explicit feedback (thumbs up/down on agent proposals) or infer from review outcomes only? Agent "version" for A/B or rollout?

**Impact**: Low–Medium - affects product evolution and tuning
```

```ctx
type: question
id: question-038
status: resolved
---
**Question**: Where does storage backend configuration live, and how is workspaceId determined for file-based storage?

**Answer**: Building the agent implies a **server component** (local or remote). For file-based context, **all configuration lives in a predefined location relative to the server**—storage, RBAC, and any other runtime config. No split between repo `.context/` and env; the server owns one config root.

**Resolution**:
- **Server-centric**: Agent deployments run a server (local or remote). The server has a single **config root** (e.g. a directory or volume mount). All runtime configuration is under that root.
- **Config under server root**: Storage backend choice and paths (file-based or MongoDB URI), RBAC provider and its config, and any other runtime settings live in that predefined location (e.g. `config/storage.json`, `config/rbac.json`, or a single `config.json`). Env vars may override for deployment (e.g. secrets, port), but the canonical layout is server-relative.
- **File-based storage**: For file backends, workspace data and indexes live under the same server root (e.g. `data/` or `workspaces/{workspaceId}/`). workspaceId is determined by server config or request context; one workspace per directory under the root, or multi-tenant layout as configured.
- **MongoDB**: Unchanged; workspaceId per-document; connection/config still read from server config root (or env override).
- **Abstraction**: Storage factory and RBAC provider both read from the same server config; no repo-scattered config for runtime behavior.

**Impact:** High - unblocks Phase 2 storage abstraction and file-based implementation
```

```ctx
type: question
id: question-039
status: open
---
**Question**: How should heightened-review recommendations (policy, security, legal, pricing, IP, personal data, access expansion) be surfaced to agents and UIs—as metadata on proposals, tool hints, or policy engine only?

**Context**: SECURITY_GOVERNANCE § Heightened review triggers recommends additional reviewers or stricter review when proposals affect sensitive domains, introduce/modify personal data handling, or expand access. Implementation can be soft (recommendations) or hard (policy engine).

**Impact:** Medium — affects Phase 3 review workflow and Phase 5 agent/UI guidance
```

```ctx
type: question
id: question-040
status: open
---
**Question**: How should “when in doubt, propose, don’t apply” be reflected in agent tooling—e.g. explicit uncertainty flags on proposals, or guidance only in agent docs/prompts?

**Context**: SECURITY_GOVERNANCE § When in doubt, propose, don’t apply: when there is ambiguity about sensitivity, correctness, ownership, or policy, create a proposal with notes and questions; surface uncertainty to reviewers. Agents should not resolve ambiguity autonomously.

**Impact:** Medium — affects Phase 5 agent loop and proposal creation UX
```

```ctx
type: question
id: question-041
status: open
---
**Question**: How to enforce or recommend workspace isolation in retrieval and prompt building (no cross-workspace context unless explicitly authorized)?

**Context**: SECURITY_GOVERNANCE § Workspace isolation: workspace boundaries are hard trust and data-isolation limits; do not assume information from one workspace can be reused in another. Affects retrieval, prompt builder, and any context sent to external models.

**Impact:** High — affects Phase 5 retrieval/prompt pipeline and risk-017 mitigation
```
