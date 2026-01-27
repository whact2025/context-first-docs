# Open Questions

This document tracks questions that need answers as the project evolves.

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

```ctx
type: question
id: question-002
status: resolved
---
**Question**: How should we handle conflicts when multiple people edit the same ctx block?

**Answer**: Hybrid approach combining conflict detection, field-level merging, manual resolution, optimistic locking, and proposal superseding.

**Resolution** (see `docs/RECONCILIATION_STRATEGIES.md`):
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
```

```ctx
type: question
id: question-003
status: resolved
---
**Question**: Should we support nested or hierarchical nodes?

**Answer**: Use a graph model with typed relationships instead of strict nesting.

**Resolution**:
- **Graph Model**: Nodes are vertices, relationships are typed edges
- **Typed Relationships**: Support multiple relationship types (parent-child, depends-on, references, supersedes, related-to, etc.)
- **Flexibility**: Can represent hierarchies, dependencies, references, and other relationships in a unified way
- **Query Power**: Graph queries enable traversal, path finding, and relationship analysis
- **Hierarchical Views**: Can project graph into hierarchical views when needed (e.g., "show subtasks", "show sub-decisions")
- **No Strict Nesting**: Avoids rigid parent-child constraints that limit flexibility

**Relationship Types**:
- `parent-child`: For hierarchical relationships (sub-decisions, subtasks)
- `depends-on`: For dependencies (task dependencies, decision dependencies)
- `references`: For references (decisions referencing goals, tasks referencing decisions)
- `supersedes`: For replacement relationships (new decision supersedes old)
- `related-to`: For general relationships
- `implements`: For implementation relationships (task implements decision)
- `blocks`: For blocking relationships (risk blocks task)
- `mitigates`: For mitigation relationships (task mitigates risk)

**Benefits**:
- More flexible than strict hierarchies
- Can represent complex multi-dimensional relationships
- Enables powerful graph queries and traversal
- Supports both hierarchical and non-hierarchical structures
- Can evolve relationship types without schema changes
- Better for AI agents to understand context and relationships

**Implementation**:
- Replace simple `relations?: NodeId[]` with typed edge structure
- Store edges separately or embedded in nodes (both approaches viable)
- Support graph queries: "find all descendants", "find all dependencies", "find path between nodes"
- Provide hierarchical projection APIs for UI/display purposes

**Impact**: Medium - affects data model complexity, but provides more power and flexibility
```

```ctx
type: question
id: question-004
status: resolved
---
**Question**: What's the best format for storing context in Git? JSON vs YAML vs custom? Should graph/document databases be considered?

**Answer**: JSON files in `.context/` directory, committed to git, as primary storage. Graph/document databases can be optional enhancement for performance at scale.

**Primary Storage: JSON Files in Git**:
- JSON provides excellent git diffs and merge conflict resolution
- Machine-friendly and deterministic
- One file per node/proposal enables scalable storage
- Committed to git provides full version history
- Git-friendly (required for non-invasive installation)
- Reviewable in PRs and GitHub/GitLab web UI
- No external infrastructure required
- See `docs/STORAGE_OPTIONS.md` for detailed analysis

**Graph/Document Databases as Optional Enhancement**:
Given the graph model (see `question-003`), graph/document databases could be valuable for:
- **Graph Databases** (Neo4j, ArangoDB, etc.):
  - Native graph query support (Cypher, AQL)
  - Optimized graph traversal and path finding
  - Relationship indexing and querying
  - Better performance for complex graph queries at scale
  - **Use Case**: Optional query/index layer for large repositories (thousands of nodes)
  
- **Document Databases** (MongoDB, CouchDB, etc.):
  - Flexible schema for evolving node types
  - Good for nested document structures
  - Can store relationships as embedded documents
  - **Use Case**: Less optimal than graph DBs for graph queries, but viable alternative

**Hybrid Approach** (Recommended for Scale):
- **Primary**: JSON files in Git (source of truth, versioned, reviewable)
- **Optional**: Graph database as query/index layer
  - Graph DB syncs from JSON files (one-way sync: Git → DB)
  - Graph DB used for complex queries and traversal
  - JSON files remain canonical source
  - Graph DB can be rebuilt from JSON files at any time
  - No data loss if graph DB unavailable

**Constraints**:
- **v1 Requirement**: Must work with Git (non-invasive installation)
- **v1 Requirement**: Must not require external infrastructure
- **v1 Requirement**: Must be reviewable in PRs
- **Future Enhancement**: Optional graph DB backend for performance

**Decision**: 
- **v1**: JSON files in Git only (meets all requirements)
- **Future**: Optional graph database backend as performance enhancement
- **Architecture**: Design context store interface to support multiple backends

**Impact**: Medium - affects developer experience and scalability
```

```ctx
type: question
id: question-005
status: open
---
**Question**: How should agents discover and consume context?

**Context**:
- Need query API
- Need to distinguish accepted vs proposed
- May need authentication/authorization

**Impact**: High - core to agent safety
```

```ctx
type: question
id: question-006
status: open
---
**Question**: What happens if issue creation fails when a proposal is approved?

**Context**:
- Issues are created automatically on approval
- Issue creation might fail (permissions, validation, etc.)
- Should approval be blocked if issues can't be created?
- Should approval succeed but issues be queued for retry?
- Need error handling and recovery strategy

**Impact**: High - affects approval workflow reliability
```

```ctx
type: question
id: question-007
status: open
---
**Question**: How are user roles assigned and managed?

**Context**:
- Roles need to be configured (contributors, approvers, admins)
- Should roles sync from GitLab/GitHub groups?
- Manual configuration vs automatic sync?
- How are roles stored? In `.context/roles.json`?
- Can roles be per-namespace or per-node-type?
- How do you handle role changes over time?

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
status: open
---
**Question**: What happens when the context store grows very large (thousands of nodes)?

**Context**:
- Performance concerns with large context graphs
- Query performance with many nodes
- Index file size and loading time
- Should there be pagination or lazy loading?
- Archival strategy for old nodes?
- Performance benchmarks and limits?

**Impact**: Medium - affects scalability
```

```ctx
type: question
id: question-013
status: open
---
**Question**: How do you handle conflicting proposals that modify the same node?

**Context**:
- Multiple proposals might modify the same node simultaneously
- Which proposal wins when both are approved?
- Should system detect conflicts and prevent approval?
- Can proposals explicitly conflict with each other?
- Merge strategy for conflicting changes?

**Impact**: High - affects data integrity
```

```ctx
type: question
id: question-014
status: open
---
**Question**: How are proposals and nodes searched and discovered?

**Context**:
- Need to find proposals by content, author, status
- Need to find nodes by type, tags, relations
- Full-text search vs structured queries?
- Search API design?
- Integration with GitLab/GitHub search?
- Search performance with large datasets?

**Impact**: Medium - affects usability
```

```ctx
type: question
id: question-015
status: open
---
**Question**: Can approved proposals be rolled back or superseded?

**Context**:
- What if an approved proposal was wrong?
- Can you create a new proposal that supersedes an old one?
- Should old proposals be marked as "superseded"?
- Rollback workflow - revert to previous state?
- How do you track proposal history and dependencies?

**Impact**: High - affects change management
```

```ctx
type: question
id: question-016
status: open
---
**Question**: What validation happens on proposals before they can be created?

**Context**:
- Should proposals be validated for structure?
- Content validation (required fields, format)?
- Reference validation (do referenced nodes exist)?
- Can invalid proposals be created and fixed later?
- Validation errors vs warnings?

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
status: open
---
**Question**: What happens if context store JSON files are corrupted or invalid?

**Context**:
- JSON files might be corrupted by manual edits
- Invalid JSON syntax
- Schema validation failures
- Recovery strategy?
- Backup and restore mechanisms?
- Validation on load vs on write?

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
status: open
---
**Question**: What's the migration path if the storage format changes?

**Context**:
- Storage format might evolve
- Need migration tools for format changes
- Version compatibility?
- How to handle breaking changes?
- Migration validation and rollback?

**Impact**: Medium - affects long-term maintenance
```

```ctx
type: question
id: question-024
status: open
---
**Question**: How do you export and backup the context store?

**Context**:
- Need backup strategies
- Export formats (JSON, YAML, Markdown)?
- Full export vs incremental?
- Backup frequency and retention?
- Disaster recovery procedures?

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
