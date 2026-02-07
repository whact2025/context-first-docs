# Agent API (read accepted truth, author proposals)

This document defines the **safe agent contract**.

## Non-negotiable rules

1. Agents may read **Accepted** truth.
2. Agents may create and update **Proposals** they own (or are delegated).
3. Agents may not accept/reject reviews.
4. Agents may not apply proposals.

## Authentication

Agents authenticate as `type=AGENT` actors and are granted scoped permissions:
- `propose` only
- optional `project` (generate projections)
- optional `search` (read-only retrieval)

## Read endpoints (accepted truth)

- `GET /v1/workspaces/{workspaceId}/revisions/{revisionId}`
- `POST /v1/workspaces/{workspaceId}/queryNodes`
- `POST /v1/workspaces/{workspaceId}/traverse` (bounded depth)

All read endpoints default to **accepted** revisions unless explicitly provided a proposal context.

## Proposal endpoints (candidate changes)

- `POST /v1/workspaces/{workspaceId}/proposals` (create)
- `PATCH /v1/workspaces/{workspaceId}/proposals/{proposalId}` (edit metadata)
- `POST /v1/workspaces/{workspaceId}/proposals/{proposalId}/operations` (append ops)
- `POST /v1/workspaces/{workspaceId}/proposals/{proposalId}/validate` (policy + schema)
- `POST /v1/workspaces/{workspaceId}/proposals/{proposalId}/submit` (status -> SUBMITTED)

## Review/apply endpoints (human authority)

- `POST /v1/workspaces/{workspaceId}/reviews` (create review for proposal)
- `POST /v1/workspaces/{workspaceId}/reviews/{reviewId}/decide` (approve/reject)
- `POST /v1/workspaces/{workspaceId}/proposals/{proposalId}/apply` (creates new accepted revision)

These require `review` / `apply` permissions.

## Safety features

- **Context mode**:
  - `accepted_only` (default)
  - `accepted_plus_proposal(proposalId)` (explicit)
- **Depth & scope limits** on traversal
- **Policy gates** on sensitive node types
- **Provenance**: all agent-authored operations are attributed to the agent actor

## NodeQuery (queryNodes)

The primary read API is **queryNodes**. Default `status: ["accepted"]` for agent safety; explicitly opt-in to include proposals.

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | NodeType[] | Filter by node types (goal, decision, constraint, task, risk, question, etc.) |
| `status` | NodeStatus[] | Default **["accepted"]**; use ["accepted","proposed"] only when needed |
| `search` | string or SearchOptions | Full-text search; optional fields, operator AND/OR, fuzzy |
| `tags` | string[] | Nodes must have all specified tags |
| `namespace` | string | Filter by node namespace |
| `createdBy`, `modifiedBy` | string | Filter by creator/modifier |
| `createdAfter`, `createdBefore`, `modifiedAfter`, `modifiedBefore` | string (ISO) | Date range |
| `relatedTo` | NodeId | Nodes related to this node |
| `relationshipTypes` | RelationshipType[] | Filter by edge type (depends-on, references, mitigates, implements, etc.) |
| `depth` | number | Traversal depth (default 1) |
| `direction` | "outgoing" \| "incoming" \| "both" | Relationship direction |
| `descendantsOf`, `ancestorsOf` | NodeId | Hierarchical queries |
| `dependenciesOf`, `dependentsOf` | NodeId | Dependency queries |
| `hasRelationship` | { type?, targetType?, direction? } | Filter by relationship existence |
| `sortBy` | "createdAt" \| "modifiedAt" \| "type" \| "status" \| "relevance" | Sort field |
| `sortOrder` | "asc" \| "desc" | Sort order |
| `limit` | number | Default 50, max 1000 |
| `offset` | number | Pagination offset |

**Response**: `{ nodes: AnyNode[], total, limit, offset, hasMore }`.

## Programmatic store interface (ContextStore)

For in-process or SDK use, the same contract is exposed as a **ContextStore** interface:

- **Read**: `getNode(nodeId)`, `queryNodes(query)`, `getProposal(proposalId)`, `queryProposals(query)`, `getProposalComments(proposalId)`, `getReviewHistory(proposalId)`.
- **Agent write**: `createProposal(proposal)`, `updateProposal(proposalId, updates)`, `addProposalComment(proposalId, comment)`. **Agents must not call**: `submitReview(review)`, `applyProposal(proposalId)`.
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

See [../appendix/RECONCILIATION_STRATEGIES.md](../appendix/RECONCILIATION_STRATEGIES.md).

## Example: agent creates a proposal

1. **Query accepted truth**: `queryNodes({ status: ["accepted"], type: ["goal","decision"], limit: 100 })`.
2. **Create proposal**: `createProposal({ baseRevisionId, title, description, operations: [{ type: "create", node: {...} }, { type: "update", nodeId, changes: {...} }], createdBy: agentActorId })`.
3. **Optional**: `detectConflicts(proposalId)` before submit; resolve or merge.
4. **Submit** (if UI/workflow allows agent to trigger submit): status → SUBMITTED. Review and apply remain human-only.

See: [../scenarios/HELLO_WORLD_SCENARIO.md](../scenarios/HELLO_WORLD_SCENARIO.md), [../scenarios/CONFLICT_AND_MERGE_SCENARIO.md](../scenarios/CONFLICT_AND_MERGE_SCENARIO.md).
