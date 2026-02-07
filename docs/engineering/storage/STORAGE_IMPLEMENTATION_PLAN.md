# Storage Implementation Plan

Target: a v1 system that is safe, auditable, and enterprise-aligned, implementing the **ContextStore** interface (see [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md)).

## Configuration (server-centric)

Agent deployments run a **server** (local or remote). All runtime configuration lives in a **predefined location relative to the server** (config root):

- **Storage**: backend choice (file vs MongoDB), connection string or data paths.
- **RBAC**: provider selection and provider-specific config (Git/GitLab, Azure AD, DLs, or other); see QUESTIONS.md question-007.
- **Other runtime**: any further server settings.

The storage factory and RBAC provider read from this config root; env vars may override for deployment (e.g. secrets, ports). File-based workspace data and indexes live under the same server root (e.g. `data/workspaces/{workspaceId}/`). See QUESTIONS.md question-038.

**Current state:** The **Rust server** (server/) provides an in-memory ContextStore and HTTP API (nodes, proposals, reviews, apply, reset). The TypeScript playground uses it via RustServerClient. File and MongoDB backends are planned; config root is already used by the Rust server (see server/README.md).

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

- **RBAC per workspace** (Reader, Contributor, Reviewer, Applier, Admin). Role assignment is deployment-specific: an **RBAC provider abstraction** supplies who has which role. Providers can be Git/GitLab (native roles), Azure AD, DLs, or any external system configured as the RBAC provider. Provider selection and config live in the **server config root** (see question-007 in QUESTIONS.md).
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
