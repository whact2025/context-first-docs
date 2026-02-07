# Architecture

## Components

1. **Truth Store**
   - **Canonical graph**: typed nodes (goal, decision, constraint, task, risk, question, etc.) and edges (depends-on, references, mitigates, implements, etc.).
   - **Accepted revisions ledger**: immutable snapshots; each apply produces a new revision (e.g. rev_1 → apply → rev_2).
   - **Proposals, reviews, comments**: proposals hold ordered operations (create/update/delete/move/status-change); reviews immutable once closed.
   - **Store interface**: ContextStore exposes queryNodes, getNode, getProposal, createProposal, submitReview, applyProposal; optional traverseReasoningChain, detectConflicts, mergeProposals, isProposalStale. **Current implementation**: the **Rust server** (server/) implements ContextStore (in-memory, HTTP API); TypeScript client in `src/api-client.ts` (RustServerClient). Playground and scenarios use the server; TS retains apply-proposal and graph helpers for preview. See [AGENT_API.md](AGENT_API.md), [../reference/DATA_MODEL_REFERENCE.md](../reference/DATA_MODEL_REFERENCE.md), server/README.md.

2. **Policy & Governance**
   - **RBAC**: workspace roles (Reader, Contributor, Reviewer, Applier, Admin); roles supplied by an **RBAC provider abstraction** (Git/GitLab, Azure AD, DLs, or configured provider; see question-007, [../reference/SECURITY_GOVERNANCE.md](../reference/SECURITY_GOVERNANCE.md)). Agents get propose only, never review/apply.
   - **Validation**: schema (node/edge types) and org policy (e.g. POLICY nodes require two approvers).
   - **Audit logging**: every review and apply recorded with actor, timestamp, revision IDs. See [SECURITY_GOVERNANCE.md](SECURITY_GOVERNANCE.md).

3. **Projection Engine**
   - generates Markdown/DOCX/HTML views
   - **Anchor maps**: projection spans to node/field anchors for comments and change detection.
   - supports “readme-style” exports

4. **Change Detection**
   - **Inputs**: projection output, anchor map, edited content. **Outputs**: proposal operations (CREATE_NODE, UPDATE_NODE, etc.); policy findings optional.
   - **Strategy**: parse sections, resolve edits to anchors, validate, emit proposal. See [../appendix/CHANGE_DETECTION.md](../appendix/CHANGE_DETECTION.md).

5. **Clients**
   - **Minimal Governance UI (required)**: list proposals, semantic diff, comments, accept/reject, apply, audit. See [UI_SPEC.md](UI_SPEC.md).
   - **Optional**: VS Code extension, web app, CLI, Office add-in. See [../appendix/OPTIONAL_INTEGRATIONS.md](../appendix/OPTIONAL_INTEGRATIONS.md).

6. **Agent** (we build it)
   - The product includes an **agent** that uses the agent-safe API: **Read** (queryNodes, getNode, default status: accepted); **Write** (createProposal, updateProposal only); never submitReview or applyProposal.
   - **Traversal**: traverseReasoningChain, buildContextChain, followDecisionReasoning, queryWithReasoning for provenance chains. See [AGENT_API.md](AGENT_API.md), [../appendix/CONTEXTUALIZED_AI_MODEL.md](../appendix/CONTEXTUALIZED_AI_MODEL.md).
   - Deployment can be in-process or via API; thin clients (chat, Slack, etc.) talk to the agent. One minimal governance UI is required for humans to review/apply.

## Core data flows

### Create truth

Accepted Revision (rev_n) → Proposal (baseRevisionId, operations[]) → Review (approve/reject) → Apply → New Accepted Revision (rev_n+1). AppliedMetadata stamped on proposal.

### Read truth

Client/Agent → queryNodes({ status: ["accepted"], ... }) or getNode(id) → use in work → optionally createProposal with deltas.

### Edit projections

Projection (Markdown/DOCX) → user edits → change detection → proposal operations → review/apply.

### Conflict handling

Concurrent proposals → detectConflicts(proposalId) → mergeable vs needsResolution; optional mergeProposals(ids); isProposalStale(proposalId) for optimistic locking. To be extended in the Rust server; design in [../appendix/RECONCILIATION_STRATEGIES.md](../appendix/RECONCILIATION_STRATEGIES.md).

## Tenancy

Every object is scoped by **workspaceId**. Workspace = unit of access control, audit boundary, retention, optional Git repo mapping.

## Server and configuration

Deployments run a **server** (local or remote). All runtime configuration—storage backend and paths, RBAC provider, and other runtime settings—lives in a **predefined location relative to the server** (config root). No repo-scattered runtime config. See QUESTIONS.md question-038 (storage/workspace), question-007 (RBAC provider).

## Storage backends

- **File-backed**: Git-friendly; JSON/YAML; paths under server config root (e.g. `data/workspaces/{workspaceId}/`); atomic writes and locking per workspace.
- **Database-backed**: MongoDB recommended for v1; connection/config from server config root; indexes on workspaceId + nodeId, revisionId, proposal status; apply as transaction.

See: [../engineering/storage/STORAGE_ARCHITECTURE.md](../engineering/storage/STORAGE_ARCHITECTURE.md), [../engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md](../engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md).
