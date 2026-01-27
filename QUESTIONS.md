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
status: open
---
**Question**: How should we handle conflicts when multiple people edit the same ctx block?

**Context**:
- Git merge conflicts are line-based, not semantic
- Need conflict resolution at the proposal level
- May need custom merge strategies

**Impact**: High - affects collaboration model
```

```ctx
type: question
id: question-003
status: open
---
**Question**: Should we support nested or hierarchical nodes?

**Context**:
- Some decisions have sub-decisions
- Tasks may have subtasks
- Could use relations instead

**Impact**: Medium - affects data model complexity
```

```ctx
type: question
id: question-004
status: resolved
---
**Question**: What's the best format for storing context in Git? JSON vs YAML vs custom?

**Answer**: JSON files in `.context/` directory, committed to git.

**Rationale**:
- JSON provides excellent git diffs and merge conflict resolution
- Machine-friendly and deterministic
- One file per node/proposal enables scalable storage
- Committed to git provides full version history
- See `docs/STORAGE_OPTIONS.md` for detailed analysis

**Impact**: Medium - affects developer experience
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
