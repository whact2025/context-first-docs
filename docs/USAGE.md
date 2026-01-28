# Usage Guide

This system is an **Agentic Collaboration Approval Layer (ACAL)**. You can use it to collaborate on **any solution** (not just software): policies, procurement decisions, product strategy, incident response, or engineering changes.

## Basic Workflow

### 1. Create Context Files

Create Markdown files with ctx blocks (a convenient authoring/projection surface):

```markdown
# Decisions

~~~ctx
type: decision
id: decision-001
status: accepted
title: Use TypeScript
---
**Decision**: Use TypeScript for type safety.

This is the **description** field (Markdown). It can include code blocks:

\`\`\`ts
export type NodeStatus = "accepted" | "proposed" | "rejected" | "superseded";
\`\`\`
~~~
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

**Note**: In “review mode”, clients should not mark proposals accepted/rejected directly. Acceptance/rejection happens via reviews (e.g. `submitReview()`), then accepted proposals can be applied.

## Example (non-development): policy or procedure change

You can model policy work the same way you model engineering work: proposals, reviews, and an approved “solution model” graph.

```markdown
# Policy Decisions

~~~ctx
type: decision
id: decision-policy-001
status: proposed
title: Require 2 approvals for high-risk policy changes
---
We require **two independent approvers** for any policy change tagged as high-risk.

Rationale:
- reduces single-actor failure
- supports separation-of-duties
~~~

~~~ctx
type: risk
id: risk-policy-001
status: accepted
severity: high
likelihood: possible
---
If we approve policy changes without quorum, we risk accidental non-compliance.
~~~
```

### 4. Apply Accepted Proposals

Accepted proposals become truth only when applied:

```typescript
await store.applyProposal("proposal-001");
```

### 5. Export to Markdown

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
        title: "Use Rust for performance-critical components",
        description: "Use Rust for performance-critical components",
        // `content` is a deterministic derived plain-text index (typically derived from `description` + title).
        content: "Use Rust for performance-critical components",
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: "agent-001",
          modifiedAt: new Date().toISOString(),
          modifiedBy: "agent-001",
          version: 1,
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
    // Optional: attach a codebase projection that can be carried onto created issues on approval.
    // codeProjection: { kind: "pull_request", url: "...", generatedAt: new Date().toISOString() },
  },
};

await store.createProposal(proposal);
```

## ctx Block Syntax

### Required Fields

- `type`: Node type (decision, goal, constraint, task, risk, etc.)
- `id`: Unique identifier (stable across edits)
- `status`: Current status (accepted, proposed, rejected, superseded)
- `---`: Separator between metadata and description (Markdown body)

### Optional Fields

- `namespace`: For organizing nodes
- `title`: Short label for display/search (recommended)

### Example

```markdown
~~~ctx
type: decision
id: decision-001
namespace: architecture
status: accepted
title: Microservices architecture
---
**Decision**: Use microservices architecture.

**Rationale**: 
- Better scalability
- Independent deployment
- Technology diversity
~~~
```

## Best Practices

1. **Use stable IDs**: Don't change node IDs unless absolutely necessary
2. **Be explicit**: Include rationale for decisions and constraints
3. **Link related nodes**: Use relations to connect related concepts
4. **Review regularly**: Keep proposals moving through review
5. **Preserve history**: Don't delete rejected proposals (they're valuable)

## Integration with Git (optional)

The system is designed to work with Git:

1. Author suggestions (proposals) from a client (UI/agent/CLI)
2. Review + accept/reject proposals
3. Apply accepted proposals into truth
4. Persist truth via your chosen storage backend (file-based/MongoDB/other)

If you choose a file-based storage backend, the canonical store can be persisted as structured data in a Git repo. Markdown is a projection format and can be committed or kept client-side — it is not canonical truth either way.
