# Review Mode (ACAL) — the invariant

TruthLayer enforces an approval workflow that makes truth governable.

## States

Truth exists as **Accepted Revisions** in a ledger.

Changes exist as **Proposals** with their own lifecycle.

### Proposal status

- `DRAFT` — created but not submitted for review
- `SUBMITTED` — awaiting review
- `CHANGES_REQUESTED` — reviewer feedback requires edits
- `ACCEPTED` — approved, ready to apply
- `REJECTED` — rejected; preserved for audit
- `APPLIED` — applied into accepted truth (terminal)

### Review status

- `OPEN`
- `APPROVED`
- `REJECTED`

### Proposal status transitions

- **DRAFT** → SUBMITTED (submit for review)
- **SUBMITTED** → CHANGES_REQUESTED (reviewer requests changes) or ACCEPTED (approved) or REJECTED (rejected)
- **CHANGES_REQUESTED** → SUBMITTED (author resubmits) or REJECTED
- **ACCEPTED** → APPLIED (human runs apply; terminal)
- **REJECTED**, **APPLIED** — terminal

(Implementation may use equivalent statuses: e.g. open → accepted/rejected → applied. Same semantics: draft → submit → review → accept/reject → apply.)

### Operation types (proposal operations)

Proposals contain an ordered list of **operations** that, when applied, mutate the graph. Supported types:

| Operation       | Description                                         | Payload                                         |
| --------------- | --------------------------------------------------- | ----------------------------------------------- |
| `create`        | Create a new node                                   | `node: AnyNode`                                 |
| `update`        | Update an existing node (field-level)               | `nodeId`, `changes: { content?, status?, ... }` |
| `delete`        | Delete a node (and optionally edges)                | `nodeId`                                        |
| `move`          | Move node in hierarchy or change relationships      | `nodeId`, target refs                           |
| `status-change` | Change node status only                             | `nodeId`, `status`                              |
| `insert`        | Insert content into a node (e.g. description block) | `sourceNodeId`, content/range                   |
| (edge ops)      | Create/delete edges between nodes                   | `fromNodeId`, `toNodeId`, `type`                |

Operations are validated against schema and policy before submit. See [../reference/DATA_MODEL_REFERENCE.md](../reference/DATA_MODEL_REFERENCE.md) for Operation schema.

## Actions and permissions

- **Create Proposal**: human or agent (permission: `propose`)
- **Submit Review**: human only (permission: `review`)
- **Accept/Reject**: reviewers only (permission: `review`)
- **Apply**: release manager / policy gate (permission: `apply`)

Agents must never be granted `review` or `apply`.

## “Applied” metadata (required)

Every applied proposal must record:

- `appliedAt` (timestamp)
- `appliedBy` (actor id)
- `appliedFromReviewId`
- `appliedFromProposalId`
- `appliedToRevisionId` (new accepted revision)
- `previousRevisionId`

This metadata is mandatory for auditability, idempotency, and governance.

**Current status:** Explicit applied state (e.g. `appliedAt`/`appliedBy`) is required by design; full implementation is tracked in PLAN task-061.

## Idempotency

- Applying the same proposal twice must be a no-op (or error) based on `appliedFromProposalId`.
- Reviews are immutable once closed.

## Policy hooks

Organizations may enforce additional rules, for example:

- Certain node types require two approvers.
- “Security policy” changes require an info-sec role.
- High-risk changes require a change window.

See: [../reference/SECURITY_GOVERNANCE.md](../reference/SECURITY_GOVERNANCE.md)
