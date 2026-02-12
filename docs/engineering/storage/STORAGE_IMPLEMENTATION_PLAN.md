# Storage Implementation Plan

Target: a v1 system that is safe, auditable, and enterprise-aligned, implementing the **ContextStore** interface (see [Storage Architecture](STORAGE_ARCHITECTURE.md)).

## Configuration (server-centric)

Agent deployments run a **server** (local or remote). All runtime configuration lives in a **predefined location relative to the server** (config root):

- **Storage**: backend choice (file vs MongoDB), connection string or data paths.
- **RBAC**: provider selection and provider-specific config (Git/GitLab, Azure AD, DLs, or other); see QUESTIONS.md question-007.
- **Other runtime**: any further server settings.

The storage factory and RBAC provider read from this config root; env vars may override for deployment (e.g. secrets, ports). File-based workspace data and indexes live under the same server root (e.g. `data/workspaces/{workspaceId}/`). See QUESTIONS.md question-038.

**Current state:** The **Rust server** (server/) provides two ContextStore backends: InMemoryStore (default) and FileStore (`TRUTHTLAYER_STORAGE=file`). The HTTP API enforces JWT authentication (HS256), hierarchical RBAC on all routes, a configurable policy engine (6 rule types from `policies.json`), an immutable audit log (queryable and exportable), sensitivity labels with agent egress control, IP protection (SHA-256 content hash), DSAR endpoints, and a retention engine. 54 tests cover routes, auth, RBAC, policy, sensitivity, store, and telemetry. The TypeScript playground uses it via RustServerClient. MongoDB backend is planned; config root is already used by the Rust server (see server/README.md).

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

## Phase 2 — Policy + RBAC (implemented)

_Status: Implemented in the Rust server._

- **Authentication**: JWT (HS256) via AuthLayer middleware. Env: `AUTH_SECRET`, `AUTH_DISABLED`.
- **RBAC per workspace** (Reader, Contributor, Reviewer, Applier, Admin). Role hierarchy enforced on all routes via `require_role()` and `reject_agent()` extractors. JWT claims supply roles; enterprise deployments integrate with Azure AD, SSO, or any external system. Provider selection and config live in the **server config root** (see question-007 in QUESTIONS.md).
- **Policy engine**: 6 configurable rule types from `policies.json`: min_approvals, required_reviewer_role, change_window, agent_restriction, agent_proposal_limit, egress_control. Evaluated at proposal create, review, and apply time; violations return 422.
- **Sensitivity labels**: Nodes carry sensitivity (public/internal/confidential/restricted). Agents restricted from reading above their allowed level (via egress_control policy). Content fingerprinting (SHA-256 content_hash) on apply.
- **Audit log**: Immutable, append-only. Every state-changing action recorded. Queryable via GET /audit, exportable as JSON/CSV.
- Agents: propose only; never review/apply (server-enforced).

## Phase 3 — Projection engine

- Markdown projection templates and inclusion rules.
- Anchor maps (projection span → node/field anchor) for comments and change detection.
- Deterministic output for same revision + template.

## Phase 4 — Change detection (Markdown)

- Parse projection; map edits to anchors; emit proposal operations (create, update, delete, move, etc.).
- Validate operations against schema; optional policy findings.
- See [Change Detection](../../appendix/CHANGE_DETECTION.md).

## Phase 5 — Conflict detection + file backend

- **Conflict detection**: detectConflicts(proposalId), isProposalStale(proposalId), mergeProposals(proposalIds); implemented in InMemoryStore; integrate with proposal lifecycle (warn on submit, optional merge flow) next.
- **File backend (implemented)**: FileStore persists nodes, proposals, reviews, and audit log as JSON under the config root data directory. Atomic writes (temp file + rename). Activated via `TRUTHTLAYER_STORAGE=file`. Same ContextStore interface as InMemoryStore.

## Phase 6 — Audit export and backup (partially implemented)

_Status: Audit export implemented; retention and DSAR erase are stubs; backup/restore in progress._

- **Audit log export (implemented)**: `GET /audit` with filters (actor, action, resource_id, date range, pagination); `GET /audit/export?format=json|csv` for full export. Admin role required.
- **DSAR export (implemented)**: `GET /admin/dsar/export?subject=actorId` (queries audit log for subject).
- **DSAR erase (stub)**: `POST /admin/dsar/erase` records an erasure audit event; actual store mutation (anonymizing actor references) is pending.
- **Retention (stub)**: Background task from `retention.json` loads rules and logs audit events on each check; actual deletion/archiving is pending (requires queryable created_at timestamps).
- Production backup/restore; see [Operations](../../reference/OPERATIONS.md).

## Success criteria

- No direct mutation of accepted truth; all changes via proposal → review → apply.
- Full audit log for every review and apply.
- Idempotent apply (duplicate apply no-op or error).
- ContextStore interface fully implemented for chosen backend(s).
- Production-ready backup/restore and optional audit export.
