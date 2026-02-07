# Data Model Reference (Canonical)

This document is the **single source of truth** for the schema.

## Tenancy

All top-level objects include:

- `workspaceId: string`

## Core types

### Actor

Represents a human or system identity.

- `actorId: string`
- `displayName: string`
- `type: "HUMAN" | "SYSTEM" | "AGENT"`
- `attributes?: object` (e.g., department, role hints)

### Revision (Accepted truth)

- `workspaceId`
- `revisionId: string`
- `createdAt: string (ISO)`
- `createdBy: actorId`
- `parentRevisionId?: string`
- `summary?: string`

Accepted revisions are immutable snapshots (or derivable via event-sourcing).

### Node

Nodes form the canonical graph.

Required:
- `workspaceId`
- `nodeId: string`
- `type: string` (enum)
- `title: string`
- `body?: string` (Markdown allowed)
- `tags?: string[]`
- `status?: string` (type-specific)
- `owners?: actorId[]`
- `createdAt, createdBy`
- `updatedAt, updatedBy` (for candidate/draft representations; accepted uses revision)

Recommended common fields:
- `rationale?: string`
- `confidence?: "LOW"|"MEDIUM"|"HIGH"`
- `sourceRefs?: SourceRef[]`

#### Node types (baseline)

- `GOAL`
- `DECISION`
- `CONSTRAINT`
- `RISK`
- `TASK`
- `QUESTION`
- `EVIDENCE`
- `POLICY`
- `PROCESS_STEP`
- `METRIC`

You can extend types per workspace with policy controls.

### Edge (Relationship)

- `workspaceId`
- `edgeId: string`
- `fromNodeId`
- `toNodeId`
- `type: string` (enum)
- `createdAt, createdBy`

Baseline edge types:
- `DEPENDS_ON`
- `SUPPORTS`
- `CONTRADICTS`
- `MITIGATES`
- `SUPERSEDES`
- `REFERENCES`
- `OWNED_BY`

### Proposal

Represents candidate changes against a base revision.

- `workspaceId`
- `proposalId: string`
- `baseRevisionId: string`
- `status: ProposalStatus`
- `title: string`
- `description?: string`
- `createdAt, createdBy`
- `updatedAt, updatedBy`
- `operations: Operation[]`
- `policyFindings?: PolicyFinding[]`
- `applied?: AppliedMetadata` (present only when APPLIED)

#### Operation (patch-like)

- `opId: string`
- `opType: "CREATE_NODE"|"UPDATE_NODE"|"DELETE_NODE"|"CREATE_EDGE"|"DELETE_EDGE"|"MOVE_NODE"|"RETYPE_NODE"`
- `targetId?: string`
- `payload: object`
- `preconditions?: object` (optional optimistic lock, e.g. field version)

### Review

- `workspaceId`
- `reviewId: string`
- `proposalId`
- `status: "OPEN"|"APPROVED"|"REJECTED"`
- `createdAt, createdBy`
- `closedAt?, closedBy?`
- `decisions: ReviewDecision[]`
- `comments: Comment[]`

### Comment (anchored)

Comments can anchor to:
- a node
- a field path within a node
- an operation in a proposal
- a projection range (Markdown/DOCX offsets) if available

- `commentId`
- `anchor: { kind: "NODE"|"FIELD"|"OPERATION"|"PROJECTION", ... }`
- `body`
- `createdAt, createdBy`
- `resolvedAt?, resolvedBy?`

### AppliedMetadata

- `appliedAt`
- `appliedBy`
- `appliedFromReviewId`
- `appliedFromProposalId`
- `appliedToRevisionId`
- `previousRevisionId`

## Projections

Projections are derived artifacts, never canonical truth.

- `ProjectionSpec`: template + inclusion rules
- `ProjectionOutput`: Markdown or DOCX + anchors map

See: [../appendix/CHANGE_DETECTION.md](../appendix/CHANGE_DETECTION.md), [../appendix/DOCX_REVIEW_INTEGRATION.md](../appendix/DOCX_REVIEW_INTEGRATION.md).

## Implementation note

The codebase uses lowercase node types (goal, decision, constraint, task, risk, question, context, plan, note) and relationship types (parent-child, depends-on, references, supersedes, related-to, implements, blocks, mitigates). Operation types in the implementation include: create, update, delete, move, status-change, insert (and edge create/delete). Schema can be extended per workspace with policy controls.
