# Change Detection and Synchronization

This document explains how the system detects changes made to Markdown files and reflects them back to the context store.

## Overview

The system uses a **bidirectional synchronization** approach:
- **Markdown → Context Store**: Changes to ctx blocks are detected and imported as proposals
- **Context Store → Markdown**: Accepted truth is exported back to Markdown deterministically

Only `ctx` blocks are managed by the system; other Markdown content is preserved.

## Change Detection Process

### 1. Extract ctx Blocks from Markdown

The system scans Markdown files for `ctx` blocks using regex pattern:

```typescript
const CTX_BLOCK_REGEX = /```ctx\n([\s\S]*?)```/g;
```

Each ctx block has the structure:
```markdown
```ctx
type: decision
id: decision-001
status: accepted
---
Content here
```
```

### 2. Parse ctx Block Structure

Each block is parsed to extract:
- **Type**: Node type (decision, task, risk, etc.)
- **ID**: Stable identifier (survives rebases/merges)
- **Namespace**: Optional namespace for organization
- **Status**: Current status (accepted, proposed, rejected, superseded)
- **Content**: The actual content (everything after `---`)
- **Position**: Start/end positions and line numbers in source file

### 3. Compare with Context Store

For each extracted ctx block:

```typescript
// Check if node exists in context store
const existingNode = await store.getNode(nodeId);

if (!existingNode) {
  // NEW NODE: Create proposal for new node
} else {
  // EXISTING NODE: Detect changes
  const changes = detectChanges(existingNode, block);
  if (changes.length > 0) {
    // CHANGES DETECTED: Create proposal for update
  }
}
```

### 4. Detect Changes

The `detectChanges()` function compares:

```typescript
function detectChanges(existingNode: AnyNode, block: CtxBlock): string[] {
  const changes: string[] = [];
  
  // Compare content
  if (existingNode.content !== block.content) {
    changes.push("content");
  }
  
  // Compare status
  if (existingNode.status !== block.status) {
    changes.push("status");
  }
  
  return changes;
}
```

**Currently Detected Changes**:
- **Content changes**: Any modification to the content section
- **Status changes**: Changes to the status field (accepted → proposed, etc.)

**Future Enhancements** (to be implemented):
- Field-level changes for typed nodes (decision.rationale, task.assignee, etc.)
- Relationship changes (added/removed relationships)
- Metadata changes (tags, namespace, etc.)

### 5. Create Proposals

When changes are detected, proposals are created:

**For New Nodes**:
```typescript
const proposal = {
  id: "proposal-001",
  status: "open",
  operations: [{
    type: "create",
    node: { /* new node data */ }
  }],
  metadata: {
    createdAt: "2026-01-26T10:00:00Z",
    createdBy: "alice",
    sourceFile: "DECISIONS.md"
  }
};
```

**For Updated Nodes**:
```typescript
const proposal = {
  id: "proposal-002",
  status: "open",
  operations: [{
    type: "update",
    nodeId: { id: "decision-001" },
    changes: {
      content: "New content...",
      status: "proposed"
    }
  }],
  metadata: {
    createdAt: "2026-01-26T10:00:00Z",
    createdBy: "alice",
    sourceFile: "DECISIONS.md"
  }
};
```

## When Change Detection Runs

### Manual Import

Users explicitly trigger import:

```typescript
import { importFromMarkdown } from "context-first-docs";
import { readFileSync } from "fs";

const markdown = readFileSync("DECISIONS.md", "utf-8");
const proposals = await importFromMarkdown(store, markdown, "alice");
```

### VS Code/Cursor Extension

The extension can:
- **On Save**: Automatically detect changes when Markdown files are saved
- **On Edit**: Detect changes in real-time as user types (optional)
- **Manual Sync**: Provide command to sync changes manually

**Extension Workflow**:
1. User edits `DECISIONS.md` in editor
2. Extension watches for file changes
3. On save (or manual trigger), extension calls `importFromMarkdown()`
4. Proposals are created and displayed in extension UI
5. User can review and submit proposals

### Git Hooks (Future)

Pre-commit or post-merge hooks can:
- Detect changes to ctx blocks in staged files
- Automatically create proposals
- Prevent commits if proposals are pending (optional)

### CI/CD Integration (Future)

CI pipelines can:
- Detect changes in PRs/MRs
- Create proposals automatically
- Validate proposals before merge

## Handling Different Change Scenarios

### Scenario 1: New ctx Block Added

```markdown
# Decisions

```ctx
type: decision
id: decision-002
status: proposed
---
**Decision**: Use GraphQL for API.
```
```

**Detection**: Node with ID `decision-002` doesn't exist in store  
**Action**: Create proposal with `create` operation

### Scenario 2: Content Modified

**Before**:
```markdown
```ctx
type: decision
id: decision-001
status: accepted
---
**Decision**: Use TypeScript.
```
```

**After**:
```markdown
```ctx
type: decision
id: decision-001
status: accepted
---
**Decision**: Use TypeScript with strict mode.
```
```

**Detection**: Content changed  
**Action**: Create proposal with `update` operation (content change)

### Scenario 3: Status Changed

**Before**:
```markdown
```ctx
type: decision
id: decision-001
status: proposed
---
**Decision**: Use TypeScript.
```
```

**After**:
```markdown
```ctx
type: decision
id: decision-001
status: accepted
---
**Decision**: Use TypeScript.
```
```

**Detection**: Status changed from `proposed` to `accepted`  
**Action**: Create proposal with `update` operation (status change)

**Note**: Status changes in Markdown are proposals, not direct mutations. The actual status change happens when the proposal is approved.

### Scenario 4: ctx Block Removed

**Detection**: ctx block exists in store but not in Markdown file  
**Action**: Create proposal with `delete` operation (to be implemented)

### Scenario 5: Non-ctx Content Changed

**Detection**: Changes outside ctx blocks  
**Action**: 
- Track changes for reference (optional)
- Update `sourceFiles` metadata on nodes
- Update referencing nodes if content affects them (bidirectional sync)

## Conflict Detection

When importing changes, the system checks for conflicts:

```typescript
// Check for conflicts with open proposals
const conflicts = await store.detectConflicts(proposalId);

if (conflicts.conflicts.length > 0) {
  // Mark proposal as conflicting
  // Require manual resolution
}
```

**Conflict Scenarios**:
- Multiple proposals modify the same node simultaneously
- Proposal modifies node that has been updated since proposal creation (stale)
- Field-level conflicts (same field changed differently)

See `docs/RECONCILIATION_STRATEGIES.md` for conflict resolution details.

## Bidirectional Sync

### Markdown → Context Store (Import)

1. Extract ctx blocks from Markdown
2. Compare with context store
3. Detect changes
4. Create proposals
5. Check for conflicts
6. Store proposals for review

### Context Store → Markdown (Export)

1. Query accepted nodes from store
2. Generate ctx blocks deterministically
3. Replace ctx blocks in Markdown (preserve other content)
4. Write updated Markdown file

**Key Principle**: Only ctx blocks are replaced; all other Markdown content is preserved.

## Role-Based Change Detection

Based on user role (see `decision-011`):

- **Contributors**: Can create proposals from Markdown edits
- **Approvers**: Can create proposals and review them
- **Admins**: Full access

**Read-Only Mode**: 
- Users without edit permissions see Markdown as read-only
- Changes are not detected/imported for read-only users
- Extension shows read-only indicators

## Performance Considerations

### Incremental Detection

- Only scan changed files (not entire repository)
- Cache parsed ctx blocks to avoid re-parsing
- Track file modification times

### Batch Processing

- Collect all changes from multiple files
- Create proposals in batch
- Single conflict check for all proposals

### Optimization Strategies

- **Lazy Parsing**: Only parse ctx blocks when needed
- **Change Tracking**: Track which files have changed since last sync
- **Incremental Updates**: Only process changed ctx blocks

## Error Handling

### Invalid ctx Block Format

```typescript
// Invalid block (missing required fields)
if (!typeMatch || !idMatch || !statusMatch) {
  // Skip block, log warning
  // Don't create proposal
}
```

### Node Not Found (Expected)

```typescript
// New node - this is expected
if (!existingNode) {
  // Create proposal for new node
}
```

### Store Errors

```typescript
try {
  const proposals = await importFromMarkdown(store, markdown, author);
} catch (error) {
  // Handle store errors
  // Log error, notify user
  // Don't lose changes - proposals can be retried
}
```

## Future Enhancements

### Field-Level Change Detection

Detect changes to specific fields in typed nodes:

```typescript
// For DecisionNode
if (existingNode.decision !== block.decision) {
  changes.push("decision");
}
if (existingNode.rationale !== block.rationale) {
  changes.push("rationale");
}
```

### Relationship Change Detection

Detect changes to relationships:

```typescript
// Detect added/removed relationships
const oldRelationships = existingNode.relationships || [];
const newRelationships = parseRelationships(block.content);
const relationshipChanges = diffRelationships(oldRelationships, newRelationships);
```

### Semantic Change Detection

Use semantic analysis to detect:
- Content rephrasing (same meaning, different words)
- Content expansion (added details)
- Content reduction (removed details)

### Real-Time Change Detection

- Watch filesystem for changes
- Detect changes as user types (debounced)
- Show live preview of proposals

### Change History

Track change history:
- When was this node last modified?
- What changes were made?
- Who made the changes?
- What proposals affected this node?

## Integration Points

### VS Code/Cursor Extension

- **File Watcher**: Monitor Markdown files for changes
- **On Save Hook**: Trigger import on save
- **Status Bar**: Show sync status and pending proposals
- **Diff View**: Show differences between Markdown and context store

### Git Integration

- **Pre-commit Hook**: Validate ctx blocks before commit
- **Post-merge Hook**: Sync changes after merge
- **Diff View**: Show ctx block changes in Git diff

### CI/CD

- **PR Validation**: Validate ctx blocks in pull requests
- **Auto-proposals**: Create proposals from PR changes
- **Conflict Detection**: Check for conflicts before merge

## Example Workflow

1. **User edits `DECISIONS.md`**:
   ```markdown
   ```ctx
   type: decision
   id: decision-001
   status: accepted
   ---
   **Decision**: Use TypeScript with strict mode.
   ```
   ```

2. **User saves file** (or extension auto-detects)

3. **Extension calls `importFromMarkdown()`**:
   ```typescript
   const proposals = await importFromMarkdown(store, markdown, "alice", "DECISIONS.md");
   ```

4. **System detects change**:
   - Extracts ctx block
   - Finds existing node `decision-001`
   - Compares content: "Use TypeScript" → "Use TypeScript with strict mode"
   - Detects content change

5. **System creates proposal**:
   ```typescript
   {
     id: "proposal-123",
     status: "open",
     operations: [{
       type: "update",
       nodeId: { id: "decision-001" },
       changes: { content: "**Decision**: Use TypeScript with strict mode." }
     }]
   }
   ```

6. **Proposal displayed in extension**:
   - User can review change
   - User can submit proposal for review
   - Approvers can accept/reject

7. **If approved**:
   - Proposal applied to context store
   - Markdown regenerated from accepted truth
   - Change is now "truth"

## Summary

The change detection system:
- ✅ Extracts ctx blocks from Markdown files
- ✅ Compares with context store to detect changes
- ✅ Creates proposals for new/modified nodes
- ✅ Handles conflicts and validation
- ✅ Preserves non-ctx content
- ✅ Supports role-based access control
- ✅ Integrates with VS Code/Cursor extension
- ✅ Works with Git workflows

This enables seamless bidirectional synchronization between human-editable Markdown and the structured context store.
