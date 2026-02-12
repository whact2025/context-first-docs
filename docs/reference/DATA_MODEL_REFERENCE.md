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

#### Governance metadata (implemented)

Nodes carry governance metadata for sensitivity classification and IP protection:

```
  Sensitivity levels (low → high)
  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────┐
  │  public   │  │ internal │  │ confidential │  │ restricted │
  │           │  │ (default)│  │              │  │            │
  └──────────┘  └──────────┘  └──────────────┘  └────────────┘
       ▲              ▲               ▲                ▲
  Agents can     Agent default    Audited when      Requires
  always read    max level        agent reads       explicit
                                                    policy
```

- `sensitivity?: "public" | "internal" | "confidential" | "restricted"` -- Content sensitivity classification. Default: `internal`. Used for agent egress control (agents are redacted from nodes above their allowed level).
- `contentHash?: string` — SHA-256 hash of node content, computed automatically on apply. Enables detection of unauthorized content duplication.
- `sourceAttribution?: "human-authored" | "agent-generated" | "imported" | "derived"` — Provenance tracking for content origin.
- `ipClassification?: "trade-secret" | "patent-pending" | "proprietary" | "internal" | "open"` — IP classification for governance.
- `license?: string` — License identifier (e.g. `"proprietary"`, `"CC-BY-4.0"`).

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
- `status: ProposalStatus` — one of `DRAFT` | `SUBMITTED` | `CHANGES_REQUESTED` | `ACCEPTED` | `REJECTED` | `WITHDRAWN` | `APPLIED`. Lifecycle and transitions: [Review Mode (ACAL)](../core/REVIEW_MODE.md).
- `title: string`
- `description?: string`
- `createdAt, createdBy`
- `updatedAt, updatedBy`
- `operations: Operation[]`
- `policyFindings?: PolicyFinding[]`
- `applied?: AppliedMetadata` (present only when APPLIED)
- **Optional (agent-assisted authoring):** `agentAssisted?: boolean`; `agentAssistedBy?: string` (e.g. "Cursor", or identifier from Git/client). Used when a **human** is the committing actor and tooling adds context that the change was authored with agent assistance. Not used for **agent-originated** proposals (where content was attracted/imported from existing systems via RAG or connectors); for those, `createdBy` may be the agent actorId and optional import metadata (e.g. `source: "import"`, `importedFrom`) may be defined elsewhere.

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

See: [Change Detection](../appendix/CHANGE_DETECTION.md), [DOCX / Word / Excel Review Integration](../appendix/DOCX_REVIEW_INTEGRATION.md).

## Implementation note

The codebase uses lowercase node types (goal, decision, constraint, task, risk, question, context, plan, note) and relationship types (parent-child, depends-on, references, supersedes, related-to, implements, blocks, mitigates). Operation types in the implementation include: create, update, delete, move, status-change, insert (and edge create/delete). Schema can be extended per workspace with policy controls.
