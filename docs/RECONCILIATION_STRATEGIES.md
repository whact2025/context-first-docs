# Reconciliation Strategies for Concurrent Work

This document outlines reconciliation options for handling conflicts when multiple people (and/or agents) propose changes to the same part of the shared solution model. For a **canonical day-in-the-life walkthrough** (starting state, proposal JSON, detectConflicts/mergeProposals/isProposalStale outcomes), see **`docs/CONFLICT_AND_MERGE_SCENARIO.md`**.

## Problem Statement

When multiple parties propose overlapping changes simultaneously:
- Git merge conflicts are line-based, not semantic
- Need conflict resolution at the proposal level
- Must preserve intent and rationale from both edits
- Should support different reconciliation strategies

## Reconciliation Strategies

### Strategy 1: Proposal-Based Conflict Detection

**Approach**: Detect conflicts at proposal creation time, before approval.

**How it works**:
- When a proposal is created, check if other open proposals modify the same node
- Mark proposals as "conflicting" if they target the same node
- Require resolution before either can be approved
- Proposals can explicitly declare conflicts with other proposals

**Pros**:
- ✅ Prevents data corruption
- ✅ Makes conflicts explicit
- ✅ Allows reviewers to see all conflicting proposals

**Cons**:
- ❌ May block legitimate parallel work
- ❌ Requires conflict detection logic
- ❌ Can create proposal dependency chains

**Use case**: Critical nodes where conflicts must be resolved before approval

---

### Strategy 2: Last-Write-Wins (Timestamp-Based)

**Approach**: The proposal approved last wins, overwrites previous changes.

**How it works**:
- Track approval timestamp for each proposal
- When applying proposals, use the most recently approved one
- Previous changes are overwritten
- History preserved in proposal log

**Pros**:
- ✅ Simple to implement
- ✅ No manual resolution needed
- ✅ Fast conflict resolution

**Cons**:
- ❌ Can lose important changes
- ❌ No merge of changes
- ❌ May overwrite recent work unintentionally

**Use case**: Low-stakes node text where latest version is always preferred

---

### Strategy 3: First-Write-Wins (Approval Order)

**Approach**: The first approved proposal wins, later proposals are rejected or require changes.

**How it works**:
- First proposal to be approved becomes truth
- Later proposals modifying same node are automatically rejected or marked as conflicts
- Reviewers see that node was already changed
- Later proposals must be updated to work with new state

**Pros**:
- ✅ Prevents overwriting accepted work
- ✅ Encourages coordination
- ✅ Clear precedence

**Cons**:
- ❌ Can block legitimate parallel work
- ❌ Requires updating proposals when base changes
- ❌ May frustrate contributors

**Use case**: Sequential workflows where order matters

---

### Strategy 4: Field-Level Merging

**Approach**: Merge changes at the field level, not the whole node.

**How it works**:
- Proposals contain field-level changes (description/title/typed fields/status/relationships/metadata, etc.)
- When multiple proposals modify different fields, merge them
- When proposals modify same field, require resolution
- Automatic merge for non-conflicting fields

**Pros**:
- ✅ Preserves all non-conflicting changes
- ✅ Reduces false conflicts
- ✅ More granular control

**Cons**:
- ❌ More complex to implement
- ❌ Requires field-level conflict detection
- ❌ May create unexpected combinations

**Use case**: Nodes with many independent fields

**Example**:
- Proposal A changes `description` field
- Proposal B changes `status` field
- Result: Both changes applied (no conflict)
 
In the normalized model, the canonical body is `description` (Markdown); `content` is derived.
So the typical “text field” to merge/conflict on is `description`.

---

### Strategy 5: Three-Way Merge (Operational Transformation)

**Approach**: Use three-way merge to combine changes intelligently.

**How it works**:
- Base version (common ancestor)
- Version A (from proposal 1)
- Version B (from proposal 2)
- Automatically merge non-conflicting changes
- Flag conflicts for manual resolution

**Pros**:
- ✅ Preserves maximum information
- ✅ Familiar to developers (Git merge)
- ✅ Can auto-resolve many conflicts

**Cons**:
- ❌ Complex to implement correctly
- ❌ May create unexpected merges
- ❌ Requires good base version tracking

**Use case**: Node description text where semantic merging makes sense

---

### Strategy 6: Manual Resolution Required

**Approach**: Always require human review and manual resolution of conflicts.

**How it works**:
- When conflicts detected, proposals marked as "conflict"
- Reviewers see all conflicting proposals side-by-side
- Reviewer manually creates merged proposal or chooses one
- System applies reviewer's resolution

**Pros**:
- ✅ Human judgment for complex conflicts
- ✅ Ensures quality
- ✅ No automatic data loss

**Cons**:
- ❌ Slower resolution
- ❌ Requires reviewer availability
- ❌ Can block workflow

**Use case**: High-stakes node text requiring careful review

---

### Strategy 7: Lock-Based (Pessimistic)

**Approach**: Prevent concurrent edits by locking nodes during editing.

**How it works**:
- When user starts editing a ctx block, lock the node
- Other users see node is "being edited" and cannot edit
- Lock released when proposal created or edit cancelled
- Timeout for abandoned locks

**Pros**:
- ✅ Prevents conflicts entirely
- ✅ Simple to understand
- ✅ No merge logic needed

**Cons**:
- ❌ Blocks parallel work
- ❌ Requires lock management
- ❌ Can create bottlenecks
- ❌ Poor for async workflows

**Use case**: Critical nodes where concurrent edits are problematic

---

### Strategy 8: Optimistic Locking (Version Numbers)

**Approach**: Track node versions, reject proposals based on stale versions.

**How it works**:
- Each node has a version number
- Proposals reference the version they're modifying
- When applying proposal, check if node version matches
- If version changed, proposal is rejected (stale)
- Author must update proposal to latest version

**Pros**:
- ✅ Allows parallel work
- ✅ Prevents overwriting recent changes
- ✅ Clear error when stale

**Cons**:
- ❌ Requires updating proposals when base changes
- ❌ May require multiple proposal iterations
- ❌ Can frustrate contributors

**Use case**: High-concurrency scenarios with version tracking

---

### Strategy 9: Proposal Superseding

**Approach**: Allow proposals to explicitly supersede other proposals.

**How it works**:
- Proposal can declare it "supersedes" another proposal
- When superseding proposal is approved, superseded proposal is marked as superseded
- System tracks proposal relationships
- Reviewers see proposal chain/history

**Pros**:
- ✅ Explicit conflict resolution
- ✅ Preserves history
- ✅ Clear intent

**Cons**:
- ❌ Requires manual declaration
- ❌ May miss implicit conflicts
- ❌ Can create complex proposal graphs

**Use case**: Iterative proposals where new version replaces old

---

### Strategy 10: Priority-Based Resolution

**Approach**: Use proposal priority or approver seniority to resolve conflicts.

**How it works**:
- Proposals have priority (low, medium, high, critical)
- Higher priority proposals win conflicts
- Or use approver role/seniority
- Automatic resolution based on priority

**Pros**:
- ✅ Fast resolution
- ✅ Respects organizational hierarchy
- ✅ Clear precedence rules

**Cons**:
- ❌ May ignore lower-priority but valid changes
- ❌ Requires priority assignment
- ❌ Can be unfair

**Use case**: Hierarchical organizations with clear priorities

---

### Strategy 11: Text-Aware Merging

**Approach**: Use semantic understanding to merge node text (primarily `description`) intelligently.

**How it works**:
- Analyze description changes semantically
- Detect if changes are complementary or conflicting
- Auto-merge complementary changes
- Flag true conflicts for resolution
- Use AI/ML for semantic analysis

**Pros**:
- ✅ Preserves maximum information
- ✅ Reduces false conflicts
- ✅ Intelligent merging

**Cons**:
- ❌ Very complex to implement
- ❌ May have edge cases
- ❌ Requires semantic analysis capabilities

**Use case**: Future enhancement with AI capabilities

---

### Strategy 12: Branch-Based (Like Git Branches)

**Approach**: Allow proposals to create "branches" of nodes.

**How it works**:
- Proposals can create alternative versions of a node
- Multiple branches can coexist
- Reviewers choose which branch to accept
- Branches can be merged later

**Pros**:
- ✅ Allows exploration of alternatives
- ✅ Preserves all options
- ✅ Familiar to developers

**Cons**:
- ❌ More complex data model
- ❌ Can create many branches
- ❌ Requires branch management

**Use case**: Experimental or exploratory changes

---

## Recommended Approach: Hybrid Strategy

**Combination of multiple strategies**:

1. **Conflict Detection** (Strategy 1): Detect conflicts at proposal creation
2. **Field-Level Merging** (Strategy 4): Auto-merge non-conflicting fields
3. **Manual Resolution** (Strategy 6): Require human review for true conflicts
4. **Proposal Superseding** (Strategy 9): Allow explicit superseding
5. **Optimistic Locking** (Strategy 8): Track versions to prevent stale updates

**Workflow**:
1. User creates proposal → System checks for conflicts
2. If no conflicts → Normal review workflow
3. If field-level conflicts → Auto-merge non-conflicting fields, flag conflicts
4. If true conflicts → Mark proposal as "conflict", require manual resolution
5. Reviewer sees all conflicting proposals, creates merged proposal or chooses one
6. System applies resolution

**Configuration**:
- Per-node-type conflict strategy
- Per-namespace conflict strategy
- Global default strategy
- Override per proposal

## Implementation Considerations

### Conflict Detection
- Compare proposals targeting same node
- Field-level comparison
- Description diff analysis
- Reference tracking

### Conflict Resolution UI
- Side-by-side comparison
- Field-level merge interface
- Comment threads on conflicts
- Resolution proposal creation

### Performance
- Efficient conflict detection
- Lazy conflict checking
- Caching conflict results
- Batch conflict resolution

### User Experience
- Clear conflict indicators
- Helpful conflict messages
- Easy resolution workflow
- Conflict prevention guidance

## Questions to Resolve

1. Should conflict detection be automatic or manual?
2. What's the default strategy for different node types?
3. Can users choose reconciliation strategy per proposal?
4. How to handle conflicts in multi-approval workflows?
5. Should conflicts block approval or allow parallel approval?
