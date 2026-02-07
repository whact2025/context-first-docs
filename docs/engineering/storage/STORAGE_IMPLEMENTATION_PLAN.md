# Storage Implementation Plan

Target: a v1 system that is safe, auditable, and enterprise-aligned, implementing the **ContextStore** interface (see [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md)).

## Phase 1 — Core schema + MongoDB

- **Canonical objects**: workspace, revision, node, edge, proposal, review, comment, AppliedMetadata.
- **Indexing**:
  - workspaceId + nodeId (unique per workspace)
  - workspaceId + revisionId
  - workspaceId + proposal status + createdAt
  - workspaceId + edge (fromNodeId, toNodeId, type) for traversal
  - Optional: full-text index on node content/title for queryNodes search
- **Apply**: single transaction — validate ACCEPTED, insert revision, update proposal APPLIED + AppliedMetadata, append audit log.
- **queryNodes**: implement filters (type, status, tags, search, date range, relatedTo, relationshipTypes, depth, sort, limit, offset) and pagination; default status `["accepted"]`.
- **Traversal**: build in-memory edge index from stored edges per workspace, or implement traverseReasoningChain via DB aggregation; same semantics as in-memory store.

## Phase 2 — Policy + RBAC

- RBAC per workspace (Reader, Contributor, Reviewer, Applier, Admin).
- Policy engine hooks: proposal validate (schema + org policy), review approve (e.g. required approvers), apply (change windows, sign-off).
- Agents: propose only; never review/apply.

## Phase 3 — Projection engine

- Markdown projection templates and inclusion rules.
- Anchor maps (projection span → node/field anchor) for comments and change detection.
- Deterministic output for same revision + template.

## Phase 4 — Change detection (Markdown)

- Parse projection; map edits to anchors; emit proposal operations (create, update, delete, move, etc.).
- Validate operations against schema; optional policy findings.
- See [../../appendix/CHANGE_DETECTION.md](../../appendix/CHANGE_DETECTION.md).

## Phase 5 — Conflict detection + optional file backend

- **Conflict detection**: detectConflicts(proposalId), isProposalStale(proposalId), mergeProposals(proposalIds); integrate with proposal lifecycle (warn on submit, optional merge flow).
- **Optional file backend**: atomic writes (temp + rename); locking per workspace; same ContextStore interface; load workspace into memory for query/traversal or implement minimal file-based query.

## Phase 6 — Audit export and backup

- Audit log export (by workspace, date range) for compliance.
- Production backup/restore; see [../../reference/OPERATIONS.md](../../reference/OPERATIONS.md).

## Success criteria

- No direct mutation of accepted truth; all changes via proposal → review → apply.
- Full audit log for every review and apply.
- Idempotent apply (duplicate apply no-op or error).
- ContextStore interface fully implemented for chosen backend(s).
- Production-ready backup/restore and optional audit export.
