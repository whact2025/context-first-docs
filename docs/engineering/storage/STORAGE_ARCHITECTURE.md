# Storage Architecture

TruthLayer supports pluggable storage backends that implement the **ContextStore** contract (or a subset for read-only/projection use).

## Canonical requirements

- **Immutable accepted revisions**: append-only or snapshot-per-revision; no in-place mutation of accepted truth.
- **Proposal/review/apply objects**: proposals (with ordered operations), reviews, comments, AppliedMetadata.
- **Query and traversal**: index by workspaceId, nodeId, revisionId, proposal status; support graph traversal (edges by from/to/type) for traverseReasoningChain and related APIs.
- **Audit logging**: every review decision and apply recorded; immutable log per workspace.
- **Workspace isolation**: all keys and queries scoped by workspaceId; no cross-workspace reads without explicit permission.

## ContextStore methods (implementation surface)

Storage backends must support at least:

- **Read**: getNode, queryNodes (with filters and pagination), getProposal, queryProposals, getProposalComments, getReviewHistory, getAcceptedNodes, getOpenProposals.
- **Write**: createProposal, updateProposal, submitReview, applyProposal; addProposalComment.
- **Conflict**: detectConflicts, isProposalStale, mergeProposals (optional for v1 file-backed).
- **Traversal**: traverseReasoningChain, buildContextChain, followDecisionReasoning, discoverRelatedReasoning, queryWithReasoning (or delegate to in-memory graph built from stored nodes/edges).

File-backed implementations may load a workspace into memory and delegate to the same query/traversal logic as the in-memory store; database backends implement queries and traversal against the DB (indexes and aggregation).

## Backend options

### Database-backed (recommended v1)

**MongoDB**:
- Collections (or equivalent): workspaces, revisions, nodes, edges, proposals, reviews, comments, audit_log.
- **Indexes**: workspaceId + nodeId (unique per workspace); workspaceId + revisionId; workspaceId + proposal status + createdAt; workspaceId + edge (from/to/type) for traversal.
- **Transactions**: apply must run in a transaction: validate proposal ACCEPTED, insert new revision, update proposal APPLIED + AppliedMetadata, write audit log.
- Natural fit for document-shaped nodes, edges, and proposals; aggregation pipelines for queryNodes filters and graph traversal.

### File-backed (Git-friendly)

- **Layout example**: `.context/workspaces/{workspaceId}/revision.json` (current accepted snapshot), `proposals.json` (array), `reviews.json`, `comments.json`; or one directory per revision and per proposal.
- **Format**: JSON or YAML; deterministic serialization for Git diff.
- **Concurrency**: atomic writes (write temp file + rename); optional file locking per workspace (e.g. lockfile) when applying.
- Suitable for small teams, single-writer, or offline workflows; conflict detection and merge can run in-memory after load.

## Apply atomicity

Apply must be **atomic** and **idempotent**:
1. Validate proposal status is ACCEPTED (and not already APPLIED).
2. Compute new accepted revision from base revision + proposal operations.
3. Write new revision to store; stamp proposal with AppliedMetadata (appliedAt, appliedBy, appliedFromReviewId, appliedFromProposalId, appliedToRevisionId, previousRevisionId).
4. Write audit log entry.
5. If already applied (e.g. retry), treat as no-op or return existing appliedToRevisionId.

See: [STORAGE_IMPLEMENTATION_PLAN.md](STORAGE_IMPLEMENTATION_PLAN.md)
