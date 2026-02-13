# Agent API (read accepted truth, author proposals)

This document defines the **safe agent contract**.

## Non-negotiable rules

1. Agents may read **Accepted** truth.
2. Agents may create and update **Proposals** they own (or are delegated).
3. Agents may **not be the committing actor** for review or apply. A human may use an agent as a **tool** (e.g. to draft a review or prepare an apply), but the **commit** (submitReview, applyProposal) must be **on behalf of the human**—the audit log attributes review/apply to the human, not the agent.
4. The server **rejects** submitReview and applyProposal when the actor is `type=AGENT`; only a human actor (or session acting on behalf of a human) may commit. So: agents assist; humans commit.
5. Agent reads are **sensitivity-gated**: nodes above the agent's allowed sensitivity level are redacted. All agent reads of confidential or restricted content are audited.
6. Agent proposals that create or modify nodes with sensitivity above the agent's allowed level are **rejected** by the policy engine (422).

## Authentication

The server enforces **JWT authentication**. Agents must include `Authorization: Bearer <token>` with a JWT containing:

- `sub`: agent ID (subject)
- `actor_type`: `"agent"`
- `roles`: e.g. `["contributor"]` (or other scoped roles)

The server validates the token via HS256 shared secret (`AUTH_SECRET`). When `AUTH_DISABLED=true` (default dev mode), a default admin actor is used.

Agents are granted scoped permissions: `propose` only; optional `project` (generate projections); optional `search` (read-only retrieval).

## HTTP verb usage

The API uses standard REST semantics:

- **GET** — Read (idempotent). Used for nodes, proposals, review history.
- **POST** — Create or action. Used for creating proposals, submitting a review, applying a proposal, withdrawing a proposal (author only), reset (dev).
- **PATCH** — Partial update. Used for updating a proposal (metadata, operations, comments).

Agents may use GET (read), POST `/proposals` (create), and PATCH `/proposals/:id` (update). When the **actor** is an agent, the server must reject POST `/proposals/:id/review`, POST `/proposals/:id/apply`, and POST `/proposals/:id/withdraw` so that review, apply, and withdraw are always committed **on behalf of a human**. (A human may use an agent to draft the review or prepare the apply, then commit with their own session.)

## Current HTTP API (Rust server)

The reference implementation (server/) exposes the following. Base URL is typically `http://127.0.0.1:3080`. Workspace-scoped paths (e.g. `/v1/workspaces/{workspaceId}/...`) support multi-tenancy.

**Read (GET)**

| Method | Path                     | Description                                                                                                                                               |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                | Liveness; returns `{ "status": "ok" }`.                                                                                                                   |
| GET    | `/nodes`                 | Query nodes. Query params: `status` (comma-separated: accepted, proposed, rejected, superseded), `limit`, `offset`. Defaults to accepted-only for safety. |
| GET    | `/nodes/:id`             | Get one node by id (namespace:id or id).                                                                                                                  |
| GET    | `/nodes/:id/provenance`  | Get full attribution/audit chain for a node.                                                                                                              |
| GET    | `/audit`                 | Query audit events (Admin only). Params: `actor`, `action`, `resource_id`, `from`, `to`, `limit`, `offset`.                                               |
| GET    | `/audit/export`          | Export audit log as JSON or CSV. Param: `format` (default: json). Admin only.                                                                             |
| GET    | `/admin/dsar/export`     | DSAR data export for a subject. Param: `subject` (actorId). Admin only.                                                                                   |
| GET    | `/proposals`             | List proposals (open by default; filter client-side or extend server for status).                                                                         |
| GET    | `/proposals/:id`         | Get one proposal.                                                                                                                                         |
| GET    | `/proposals/:id/reviews` | Get review history for a proposal.                                                                                                                        |

**Create and actions (POST)**

| Method | Path                      | Description                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/proposals`              | Create proposal. Body: Proposal JSON. Returns 201.                                                                                                                                                                                                                                                                                                                                    |
| POST   | `/proposals/:id/review`   | Submit a review (human only). Body: Review JSON.                                                                                                                                                                                                                                                                                                                                      |
| POST   | `/proposals/:id/apply`    | Apply proposal (human only). Optional body: `{ "appliedBy": "actorId" }` for audit; if omitted, server may use session or default. Proposal status → APPLIED; store AppliedMetadata (appliedAt, appliedBy, appliedFromProposalId, appliedToRevisionId, previousRevisionId). Idempotent: if already APPLIED, return 200 without re-applying. See § Applied state and idempotent apply. |
| POST   | `/proposals/:id/withdraw` | Withdraw proposal (author only). No body. Allowed only from DRAFT, SUBMITTED, or CHANGES_REQUESTED; proposal status → WITHDRAWN. See [Review Mode](REVIEW_MODE.md) § Withdraw and reopen.                                                                                                                                                                                             |
| POST   | `/admin/dsar/erase`       | DSAR erase: records erasure audit event. Body: `{ "subject": "actorId" }`. Admin only. Store mutation pending.                                                                                                                                                                                                                                                                        |
| POST   | `/reset`                  | Reset store (dev only). No body.                                                                                                                                                                                                                                                                                                                                                      |

**Partial update (PATCH)**

| Method | Path             | Description                                                                                                                   |
| ------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PATCH  | `/proposals/:id` | Partially update a proposal. Body: JSON object with fields to update (e.g. `operations`, `comments`, `title`, `description`). |

Agents may call: GET on all read paths; POST `/proposals`; PATCH `/proposals/:id`. Agents must not call POST `/proposals/:id/review`, POST `/proposals/:id/apply`, or POST `/proposals/:id/withdraw` (withdraw is author-only; server rejects when actor is `type=AGENT`).

### Applied state and idempotent apply

- **Proposal status APPLIED:** After a successful apply, the proposal’s status is **APPLIED** (terminal). UIs can distinguish **ACCEPTED** (approved, not yet applied) from **APPLIED** (changes committed to accepted truth).
- **AppliedMetadata (required when APPLIED):** Every applied proposal must have `applied` set with: `appliedAt`, `appliedBy`, `appliedFromProposalId`, `appliedToRevisionId`, `previousRevisionId`; optionally `appliedFromReviewId`. See [Data Model Reference](../reference/DATA_MODEL_REFERENCE.md) AppliedMetadata, [Review Mode](REVIEW_MODE.md) § "Applied" metadata.
- **Idempotent apply:** Applying the same proposal again (same proposalId) must **not** mutate the graph a second time. The server either returns **200** with no-op (already applied) or **409 Conflict** if the implementation treats re-apply as an error. Clients can rely on "apply once" semantics; UIs can disable the Apply action when status is already APPLIED.
- **Double-apply prevention:** The server must reject or no-op apply when `proposal.status === APPLIED`; only proposals in status **ACCEPTED** may be applied (once).

## Safety features

- **Context mode**:
  - `accepted_only` (default)
  - `accepted_plus_proposal(proposalId)` (explicit)
- **Depth & scope limits** on traversal
- **Policy gates** on sensitive node types: implemented rules include `min_approvals`, `required_reviewer_role`, `change_window`, `agent_restriction`, `agent_proposal_limit`, `egress_control`
- **Sensitivity-based content redaction**: when an agent reads a node above its allowed sensitivity (via `egress_control`), the server returns `{ redacted: true, reason: "sensitivity" }` instead of content
- **Provenance**: all agent-authored operations are attributed to the agent actor

## Sensitivity and content redaction

When an agent reads a node (`GET /nodes/:id` or `GET /nodes`), the server checks the node's `sensitivity` label against the agent's maximum allowed sensitivity (configured via the `egress_control` policy rule; default: `internal`). If the node's sensitivity exceeds the agent's level:

- The response returns `{ "id": ..., "type": ..., "status": ..., "redacted": true, "reason": "sensitivity" }` instead of the full content.
- The read is logged to the audit trail with outcome `denied`.

Agent reads of `confidential` or `restricted` nodes (even when allowed) are always logged to the audit trail for compliance.

Sensitivity levels (ordered low to high): `public`, `internal`, `confidential`, `restricted`. Default for nodes without an explicit label: `internal`.

## Agent identity, audit, and two scenarios

These concepts are distinct and must not be confused.

### Agent identity and audit (attribution when the agent creates a proposal)

Agents authenticate as `type=AGENT` with a **stable agent identity** (e.g. `agentId`, or deployment/process identifier) so the audit trail can record "proposal created by Agent X" and support compliance. Multiple agent instances can be namespaced per workspace or team; RBAC uses the same actor model (agent as principal for proposals it creates). See QUESTIONS.md question-034 (resolved).

### Agent-assisted (authoring): human in the loop, tooling adds context

**Agent-assisted** describes the case where a **human** is the committing actor and an IDE or tool (e.g. Cursor, Git-integrated workflow) helps **author** the change. The human commits; the agent does not appear as the principal in review/apply. Optional context can be supplied so the system knows the change was authored with agent assistance:

- **Source of context:** Git (e.g. commit trailers, message), or the client when creating/updating a proposal (e.g. "agent-assisted by Cursor").
- **Use:** Audit and compliance can record "committed by human X, agent-assisted by Y"; optional proposal metadata (e.g. `agentAssisted`, `agentAssistedBy`) supports filtering and policy.
- **Principal:** Always the human. This is **not** the same as the proposal being created by an agent as principal.

### Agent-originated (RAG / attracting proposals from existing systems)

**Agent-originated** (or **agent-as-importer**) describes the case where an agent or integration is used to **attract or import** truth proposals **from existing systems**—e.g. RAG over external docs, connectors to Confluence/Notion, sync from other knowledge bases. The agent discovers or selects content from outside TruthLayer and creates (or suggests) proposals from that data.

- **Flow:** Content is pulled from external systems; the agent (or a human acting on behalf of an integration) creates the proposal. The **creator** may be the agent (`createdBy` = agent actorId) or a human who triggered the import.
- **Distinction:** This is about **origin** (content from existing systems) and **how** it entered TruthLayer (RAG, connector, sync), not "human wrote it with AI pair programming." Attribution and metadata may differ: e.g. `createdBy` = agent when the agent creates the proposal; optional fields like `source: "import"`, `importedFrom`, or `importedBy` for audit.
- **Use case:** Attract truth proposals from existing systems into the governance workflow, rather than authoring proposals purely inside TruthLayer with agent assistance.

Summary: **Agent-assisted** = human authors/commits, tooling adds "agent assisted" context for audit. **Agent-originated** = agent (or integration) attracts/imports proposals from existing systems; different flow and possibly different attribution (e.g. agent as creator).

## Agent posture: enforcement bias

Agents must align with a **conservative, governance-first** posture. The following are **enforcement bias**—default behavior that implementers and system prompts must follow, not optional guidance.

1. **Default posture: conservative, governance-first**  
   Assume content may be **confidential or regulated** unless explicitly marked otherwise. Favor **abstraction**, **anonymization**, and **proposals** over direct resolution.

2. **Personal data handling**  
   If personal data is detected: **minimize, anonymize, or isolate it**; **recommend heightened review**; **do not embed it in accepted truth** unless policy explicitly requires it.

3. **External processing**  
   **Do not assume permission** to send content outside the workspace boundary. If policy is unclear, **treat external LLM usage as disallowed by default** and **escalate** (e.g. via proposal or comments asking for policy).

4. **Trade secret awareness**  
   **Do not restate or summarize** sensitive IP unless necessary for the task and audience. **Prefer references** to existing accepted truth over reproduction.

5. **Immutability-aware writing**  
   Write accepted truth (via proposals) so it **can survive future redaction or erasure requests** without losing meaning—e.g. dedicated fields for personal data, role-based references, no irreversible narrative mixing identifiers with policy.

6. **Escalation bias**  
   **When in doubt, propose and ask.** **Never resolve ambiguity autonomously** in policy, legal, security, or IP-sensitive domains. Surface uncertainty to reviewers.

See [Security & Governance](../reference/SECURITY_GOVERNANCE.md) and [Privacy and Data Protection](../reference/PRIVACY_AND_DATA_PROTECTION.md). Operational detail below.

---

### Personal data (operational)

- **Detect** possible personal data: names, emails, IDs, incident participants. **Minimize, anonymize, or isolate**: use anonymized roles (e.g. “Engineer A”) or structured references; put personal data in **dedicated fields/nodes** that support redaction or crypto-shredding. **Do not** mix identifiers with policy in long-form narrative.
- **Always recommend heightened review** when personal data is present. **Do not embed** personal data in accepted truth unless policy explicitly requires it. Keep sensitive mentions in rationale **minimal** and only when needed for review.

### Summarizing and exporting (operational)

- **Default to abstraction.** Do not restate or summarize sensitive specs, pricing, credentials, or proprietary methods unless **necessary for the task and authorized by policy**. Prefer **references** to existing accepted truth over reproduction. For broad audiences, **propose a redacted projection** rather than exposing full truth.

### External model usage (operational)

- **Do not send** truth or proposals to an external LLM or service unless workspace policy **explicitly allows** it. If policy is unknown, **do not egress**; **escalate** (proposal or comments: “External model use not configured; propose a policy or confirm allowlist”). When allowed, **avoid verbatim sensitive content** in prompts; use abstractions or redacted excerpts.

### AI Compliance Gateway

When the AI Compliance Gateway is active, agents and MCP clients **do not call external models directly**. All external model interactions route through TruthLayer's gateway:

1. Agent calls a **gateway tool** (e.g. `gateway_query`) with a prompt
2. TruthLayer authenticates, checks RBAC, evaluates `EgressControl` (sensitivity + destination allowlist)
3. Prompt inspection: scan against sensitivity labels, redact content above egress threshold
4. Route to allowed model per workspace config (allowlist, region, rate/cost limits)
5. Response filtering: check for policy violations, hallucinated permissions, injection
6. Audit log: `ExternalModelCall` event (provider, model, prompt hash, cost, latency)
7. Return filtered response to caller

**Effect on agent posture**: When the gateway is enabled, the "do not egress" rule is enforced by infrastructure. Agents call gateway tools; the gateway decides whether and where the prompt goes. See [Architecture](ARCHITECTURE.md), [Security & Governance](../reference/SECURITY_GOVERNANCE.md).

### Additional reviewers (operational)

- **Recommend additional reviewers** (or stricter review) when a proposal touches: **legal, policy, or security** domains; **IP-sensitive** content (pricing, roadmap, architecture secrets); **identity or access** changes; **personal data handling or retention**. Surface the recommendation in the proposal so reviewers can assign. **When in doubt, propose and ask**—do not resolve autonomously in these domains.

## Truth anchoring contract

Model output is **never truth** (decision-037). The agent loop performs truth anchoring — classifying response segments against accepted truth. Agents, prompt implementers, and system prompts must follow these rules:

### Citation requirement

When referencing organizational facts from retrieved context, the model **must** cite the source node using `[node:ID]` syntax. The server verifies every citation:

- **Verified citation**: node exists, is accepted, and content approximately supports the claim → `citation` SSE event with `verified: true`
- **Failed citation**: node doesn't exist, wrong status, or content doesn't support claim → `citation` SSE event with `verified: false` + `grounding` event marking segment as `ungrounded`

### Grounding tiers

Every response segment is classified into one of four tiers:

| Tier | Meaning | Agent behavior |
| --- | --- | --- |
| **Grounded** | Directly supported by a verified accepted node | Present confidently with citation |
| **Derived** | Logically inferred from multiple accepted nodes | Present with citations, explicitly note inference: "Based on [node:X] and [node:Y], this suggests..." |
| **Ungrounded** | Not supported by retrieved context | Must be clearly qualified: "I don't have accepted truth supporting this, but..." or "This is my analysis, not an established fact..." |
| **Contradicted** | Conflicts with an accepted node | Must surface the contradiction: "Note: this differs from the accepted position in [node:X]..." |

### Grounding metadata on proposals

When the agent creates a proposal via `create_proposal`, the proposal inherits grounding metadata:

- `groundingTier`: the overall grounding tier of the reasoning that led to the proposal
- `citedNodes`: list of accepted node IDs that were cited as supporting evidence
- `uncitedClaims`: list of factual claims in the proposal that are not grounded in accepted truth
- `contradictions`: list of conflicts with accepted nodes, if any

This metadata is visible to reviewers in the governance UI, helping them calibrate trust when deciding whether to approve.

### Confidence scoring

The server computes a confidence score (0.0–1.0) for each grounding classification based on:
- **Citation density**: fraction of factual claims with verified citations
- **Citation accuracy**: semantic match between cited node content and the model's claim
- **Traversal depth**: 1-hop from an accepted node = higher confidence; long inference chain = lower
- **Recency**: recently reviewed nodes score higher than old revisions

The score is a **signal for human reviewers**, not a truth determination. It appears in the grounding summary and in proposal metadata.

### Agent posture for ungrounded output

When the model produces output with no grounding in accepted truth (creative suggestions, estimates, novel analysis):

1. The model must **explicitly qualify** the output as its own analysis, not organizational fact
2. If the user requests a proposal from ungrounded output, the proposal metadata carries `groundingTier: "ungrounded"` — visible to reviewers
3. The system never silently promotes ungrounded output to truth; the ACAL process is the sole mechanism

See [Contextualized AI Model](../appendix/CONTEXTUALIZED_AI_MODEL.md) § Truth anchoring pipeline, [Architecture](ARCHITECTURE.md) §9, decision-037.

## NodeQuery (queryNodes)

The primary read API is **queryNodes**. Default `status: ["accepted"]` for agent safety; explicitly opt-in to include proposals.

| Parameter                                                          | Type                                                             | Description                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `type`                                                             | NodeType[]                                                       | Filter by node types (goal, decision, constraint, task, risk, question, etc.) |
| `status`                                                           | NodeStatus[]                                                     | Default **["accepted"]**; use ["accepted","proposed"] only when needed        |
| `search`                                                           | string or SearchOptions                                          | Full-text search; optional fields, operator AND/OR, fuzzy                     |
| `tags`                                                             | string[]                                                         | Nodes must have all specified tags                                            |
| `namespace`                                                        | string                                                           | Filter by node namespace                                                      |
| `createdBy`, `modifiedBy`                                          | string                                                           | Filter by creator/modifier                                                    |
| `createdAfter`, `createdBefore`, `modifiedAfter`, `modifiedBefore` | string (ISO)                                                     | Date range                                                                    |
| `relatedTo`                                                        | NodeId                                                           | Nodes related to this node                                                    |
| `relationshipTypes`                                                | RelationshipType[]                                               | Filter by edge type (depends-on, references, mitigates, implements, etc.)     |
| `depth`                                                            | number                                                           | Traversal depth (default 1)                                                   |
| `direction`                                                        | "outgoing" \| "incoming" \| "both"                               | Relationship direction                                                        |
| `descendantsOf`, `ancestorsOf`                                     | NodeId                                                           | Hierarchical queries                                                          |
| `dependenciesOf`, `dependentsOf`                                   | NodeId                                                           | Dependency queries                                                            |
| `hasRelationship`                                                  | { type?, targetType?, direction? }                               | Filter by relationship existence                                              |
| `sortBy`                                                           | "createdAt" \| "modifiedAt" \| "type" \| "status" \| "relevance" | Sort field                                                                    |
| `sortOrder`                                                        | "asc" \| "desc"                                                  | Sort order                                                                    |
| `limit`                                                            | number                                                           | Default 50, max 1000                                                          |
| `offset`                                                           | number                                                           | Pagination offset                                                             |

**Response**: `{ nodes: AnyNode[], total, limit, offset, hasMore }`.

The Rust server exposes NodeQuery via GET `/nodes` query params: `status`, `limit`, `offset`, with full query capabilities (search, tags, relationshipTypes, traversal, etc.) defined by the ContextStore contract.

## Programmatic store interface (ContextStore)

For in-process or SDK use, the same contract is exposed as a **ContextStore** interface. The reference implementation is the **Rust server** (server/), which exposes this contract over HTTP; the TypeScript client (src/api-client.ts) implements ContextStore against the server. See [Architecture](ARCHITECTURE.md) and server/README.md.

- **Read**: `getNode(nodeId)`, `queryNodes(query)`, `getProposal(proposalId)`, `queryProposals(query)`, `getProposalComments(proposalId)`, `getReviewHistory(proposalId)`.
- **Agent write**: `createProposal(proposal)`, `updateProposal(proposalId, updates)`, `addProposalComment(proposalId, comment)`. **Agents must not call**: `submitReview(review)`, `applyProposal(proposalId)`, `withdrawProposal(proposalId)` (withdraw is author-only; see [Review Mode](REVIEW_MODE.md) § Withdraw and reopen).
- **Conflict**: `detectConflicts(proposalId)` → `{ conflicts, mergeable, needsResolution }`; `isProposalStale(proposalId)` → boolean; `mergeProposals(proposalIds)` → MergeResult (field-level merge).

## Traversal and reasoning APIs

Provenance chains follow **typed relationships** in the graph (e.g. goal → decision → risk → task). These are graph traversals, not LLM chain-of-thought.

- **traverseReasoningChain(startNodeId, options)**
  - `options.path`: array of `{ relationshipType, targetType? }`; `maxDepth`; `accumulateContext`, `includeRationale`.
  - Returns: `{ nodes, path, reasoningSteps?, accumulatedContext? }`.

- **buildContextChain(startNodeId, options)**
  - `relationshipSequence`, `maxDepth`, `includeReasoning`, `stopOn` (node types), `accumulate`.
  - Returns: `{ startNode, chains, accumulatedContext, reasoningPath }`.

- **followDecisionReasoning(decisionId, options)**
  - `includeGoals`, `includeAlternatives`, `includeImplementations`, `includeRisks`, `includeConstraints`, `depth`.
  - Returns: `{ decision, goals, alternatives, implementations, risks, constraints, reasoningChain }`.

- **discoverRelatedReasoning(nodeId, options)**
  - `relationshipTypes`, `includeSemanticallySimilar`, `buildReasoningChain`, `maxDepth`.
  - Returns: `{ startNode, relatedNodes, reasoningChains?, similarityScores? }`.

- **queryWithReasoning(options)**
  - Combines a base `query` (NodeQuery) with `reasoning.enabled`, `followRelationships`, `includeRationale`, `buildChain`, `maxDepth`.
  - Returns: `{ primaryResults, reasoningChains, accumulatedContext, reasoningPath }`.

## Conflict detection and merge

- **detectConflicts(proposalId)**: Compares the proposal's operations (by node and field) with other open proposals. Returns `conflicts` (array of { proposals, conflictingNodes, conflictingFields?, severity, autoResolvable }), `mergeable` (proposal IDs that can be merged), `needsResolution` (proposal IDs requiring human resolution).
- **isProposalStale(proposalId)**: True if the base revision or target nodes have changed since the proposal was created (optimistic locking).
- **mergeProposals(proposalIds)**: Attempts field-level merge; returns `{ merged, conflicts, autoMerged }` for fields that could not be auto-merged.

See [Reconciliation Strategies](../appendix/RECONCILIATION_STRATEGIES.md).

## Example: agent creates a proposal

1. **Query accepted truth**: `queryNodes({ status: ["accepted"], type: ["goal","decision"], limit: 100 })`.
2. **Create proposal**: `createProposal({ baseRevisionId, title, description, operations: [{ type: "create", node: {...} }, { type: "update", nodeId, changes: {...} }], createdBy: agentActorId })`.
3. **Optional**: `detectConflicts(proposalId)` before submit; resolve or merge.
4. **Submit** (if UI/workflow allows agent to trigger submit): status → SUBMITTED. Review and apply remain human-only.

See: [Hello World Scenario](../scenarios/HELLO_WORLD_SCENARIO.md), [Conflict and Merge Scenario](../scenarios/CONFLICT_AND_MERGE_SCENARIO.md).

## MCP exposure

TruthLayer **provides an MCP (Model Context Protocol) server** so AI assistants (Cursor, Claude Desktop, etc.) can use it as a native tool. This gives:

- **Tools**: Map to the agent-safe API—e.g. `query_nodes`, `get_node`, `traverse_reasoning_chain`, `create_proposal`, `add_proposal_operations`. No tools for submitReview or applyProposal; those remain human-only.
- **Resources** (optional): Read-only URIs for accepted context (e.g. workspace nodes, proposal list) so the assistant can load context without explicit tool calls when appropriate.
- **Auth**: MCP server runs in the user’s environment; authentication and workspace scope follow the same RBAC and config as the HTTP API (server config root, RBAC provider).

Clients configure the TruthLayer MCP server in their MCP config (e.g. Cursor: `.cursor/mcp.json`). The same agent-safe rules apply: agents read accepted truth and create proposals only; humans ratify in the minimal governance UI.
