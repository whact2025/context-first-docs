# Open Questions

This document tracks questions that need answers as the project evolves.

```ctx
type: question
id: question-001
status: open
---
**Question**: Should Markdown files be read-only (generated only) or editable?

**Context**: 
- Read-only ensures no drift between store and Markdown
- Editable allows familiar Git workflows
- Could support both modes

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
status: open
---
**Question**: What's the best format for storing context in Git? JSON vs YAML vs custom?

**Context**:
- JSON is more machine-friendly
- YAML is more human-readable
- Custom format could be optimized

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
