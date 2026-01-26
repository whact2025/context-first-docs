# Usage Guide

## Basic Workflow

### 1. Create Context Files

Create Markdown files with ctx blocks:

```markdown
# Decisions

```ctx
type: decision
id: decision-001
status: accepted
---
**Decision**: Use TypeScript for type safety.

**Rationale**: Type safety prevents common errors and improves developer experience.
```
```

### 2. Import Changes

When you edit a ctx block, import the changes:

```typescript
import { importFromMarkdown } from "context-first-docs";
import { readFileSync } from "fs";

const markdown = readFileSync("DECISIONS.md", "utf-8");
const proposals = await importFromMarkdown(store, markdown, "alice");
```

### 3. Review Proposals

Review and accept/reject proposals:

```typescript
await store.submitReview({
  id: "review-001",
  proposalId: "proposal-001",
  reviewer: "bob",
  reviewedAt: new Date().toISOString(),
  action: "accept",
});
```

### 4. Export to Markdown

Generate Markdown from accepted truth:

```typescript
import { projectToMarkdown } from "context-first-docs";

const markdown = await projectToMarkdown(store);
await writeFileSync("DECISIONS.md", markdown);
```

## Agent Usage

### Querying Context

```typescript
// Get all accepted decisions
const decisions = await store.queryNodes({
  type: ["decision"],
  status: ["accepted"],
});

// Get open proposals
const proposals = await store.getOpenProposals();

// Get specific node
const node = await store.getNode({ id: "decision-001" });
```

### Creating Proposals

```typescript
import { Proposal, CreateOperation } from "context-first-docs";

const proposal: Proposal = {
  id: "proposal-001",
  status: "open",
  operations: [
    {
      id: "op-001",
      type: "create",
      order: 0,
      node: {
        id: { id: "decision-002" },
        type: "decision",
        status: "proposed",
        content: "Use Rust for performance-critical components",
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: "agent-001",
          modifiedAt: new Date().toISOString(),
          modifiedBy: "agent-001",
        },
      },
    },
  ],
  metadata: {
    createdAt: new Date().toISOString(),
    createdBy: "agent-001",
    modifiedAt: new Date().toISOString(),
    modifiedBy: "agent-001",
    rationale: "Performance analysis suggests Rust would improve latency",
  },
};

await store.createProposal(proposal);
```

## ctx Block Syntax

### Required Fields

- `type`: Node type (decision, goal, constraint, task, risk, etc.)
- `id`: Unique identifier (stable across edits)
- `status`: Current status (accepted, proposed, rejected, superseded)
- `---`: Separator between metadata and content

### Optional Fields

- `namespace`: For organizing nodes

### Example

```markdown
```ctx
type: decision
id: decision-001
namespace: architecture
status: accepted
---
**Decision**: Use microservices architecture.

**Rationale**: 
- Better scalability
- Independent deployment
- Technology diversity
```
```

## Best Practices

1. **Use stable IDs**: Don't change node IDs unless absolutely necessary
2. **Be explicit**: Include rationale for decisions and constraints
3. **Link related nodes**: Use relations to connect related concepts
4. **Review regularly**: Keep proposals moving through review
5. **Preserve history**: Don't delete rejected proposals (they're valuable)

## Integration with Git

The system is designed to work with Git:

1. Edit Markdown files locally
2. Import changes as proposals
3. Review proposals
4. Commit accepted changes
5. Push to remote

The context store can be stored in Git as structured data (JSON/YAML), while Markdown files remain human-readable.
